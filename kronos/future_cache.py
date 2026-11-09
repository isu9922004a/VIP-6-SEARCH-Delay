"""Inference-only causal KV cache for pinned Kronos-small, with full-context fallback.

Keeps the upstream predictor, normalization, tokenizer and sampler unchanged.
Only reuse causal attention keys/values and compute the consumed final logits.
"""
import types
import torch
import torch.nn.functional as F

class CausalCache:
    def __init__(self, model):
        if model.training:
            raise ValueError('Cache requires model.eval()')
        self.model=model
        self.reset()

    def reset(self):
        self.layers=[];self.context=None;self.pre=None;self.post=None;self.stamp=None

    def decode_s1(self,pre,post,stamp=None,padding_mask=None):
        if padding_mask is not None or stamp is None or pre.size(1)>512:
            raise ValueError('Unsupported cache input')
        incremental=(self.pre is not None and pre.shape[0]==self.pre.shape[0] and pre.shape[1]==self.pre.shape[1]+1
            and torch.equal(pre[:,:-1],self.pre) and torch.equal(post[:,:-1],self.post) and torch.equal(stamp[:,:-1],self.stamp))
        if not incremental:self.reset()
        offset=pre.size(1)-1 if incremental else 0
        a=pre[:,-1:] if incremental else pre;b=post[:,-1:] if incremental else post;t=stamp[:,-1:] if incremental else stamp
        x=self.model.embedding([a,b])+self.model.time_emb(t)
        x=self.model.token_drop(x)
        next_layers=[]
        for i,layer in enumerate(self.model.transformer):
            residual=x;z=layer.norm1(x);attn=layer.self_attn;batch,length,_=z.shape
            q=attn.q_proj(z).view(batch,length,attn.n_heads,attn.head_dim).transpose(1,2)
            k=attn.k_proj(z).view(batch,length,attn.n_heads,attn.head_dim).transpose(1,2)
            v=attn.v_proj(z).view(batch,length,attn.n_heads,attn.head_dim).transpose(1,2)
            cos,sin=attn.rotary._update_cos_sin_cache(q,pre.size(1));cos=cos[:,:,offset:offset+length,:];sin=sin[:,:,offset:offset+length,:]
            q=q*cos+attn.rotary._rotate_half(q)*sin;k=k*cos+attn.rotary._rotate_half(k)*sin
            if incremental:k=torch.cat([self.layers[i][0],k],dim=2);v=torch.cat([self.layers[i][1],v],dim=2)
            next_layers.append((k,v))
            attended=F.scaled_dot_product_attention(q,k,v,dropout_p=0.0,is_causal=not incremental)
            attended=attended.transpose(1,2).contiguous().view(batch,length,attn.d_model)
            x=residual+attn.resid_dropout(attn.out_proj(attended));x=x+layer.ffn(layer.norm2(x))
        context=self.model.norm(x)
        self.context=torch.cat([self.context,context],dim=1) if incremental else context
        self.layers=next_layers;self.pre=pre.clone();self.post=post.clone();self.stamp=stamp.clone()
        return self.model.head(context[:,-1:]),self.context

    def decode_s2(self,context,pre,padding_mask=None):
        if padding_mask is not None:raise ValueError('Unsupported conditional padding')
        sibling=self.model.embedding.emb_s1(pre)
        attention=self.model.dep_layer.cross_attn(sibling,context,context)
        return self.model.head.cond_forward(self.model.dep_layer.norm(context[:,-1:]+attention))

    def install(self):
        model=self.model;self.original=(model.decode_s1,model.decode_s2)
        model.decode_s1=types.MethodType(lambda _,*a,**kw:self.decode_s1(*a,**kw),model)
        model.decode_s2=types.MethodType(lambda _,*a,**kw:self.decode_s2(*a,**kw),model)
        return self

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.restore()

    def restore(self):
        self.model.decode_s1,self.model.decode_s2=self.original
        self.reset()
