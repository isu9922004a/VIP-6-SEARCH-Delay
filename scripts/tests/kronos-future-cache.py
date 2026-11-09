import sys,torch,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'kronos'))
from run import load_runtime
from future_cache import CausalCache
predictor,lock,receipt=load_runtime('cpu',2);model=predictor.model
cache=CausalCache(model);torch.manual_seed(719)
a=torch.randint(0,1024,(2,180));b=torch.randint(0,1024,(2,180));stamp=torch.zeros(2,180,5);stamp[:,:,2]=1;stamp[:,:,3]=3;stamp[:,:,4]=11
max_s1=max_s2=max_context=0
with torch.inference_mode():
 for n in [160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179]:
  s1,c=model.decode_s1(a[:,:n],b[:,:n],stamp[:,:n]);s2=model.decode_s2(c,a[:,n:n+1]);v1,vc=cache.decode_s1(a[:,:n],b[:,:n],stamp[:,:n]);v2=cache.decode_s2(vc,a[:,n:n+1]);
  torch.testing.assert_close(v1,s1[:,-1:],atol=2e-5,rtol=2e-5);torch.testing.assert_close(v2,s2[:,-1:],atol=2e-5,rtol=2e-5);torch.testing.assert_close(vc,c,atol=2e-5,rtol=2e-5)
  max_s1=max(max_s1,float((v1-s1[:,-1:]).abs().max()));max_s2=max(max_s2,float((v2-s2[:,-1:]).abs().max()));max_context=max(max_context,float((vc-c).abs().max()))
result={'status':'PASS','steps':20,'batch':2,'maxS1LogitDifference':max_s1,'maxS2LogitDifference':max_s2,'maxContextDifference':max_context}
# Batch boundary and nonmatching prefixes must reset instead of leaking old cache state.
with torch.inference_mode():
 cache.reset()
 v1,vc=cache.decode_s1(a[:,:160],b[:,:160],stamp[:,:160])
 altered=a[:,:161].clone();altered[:,0]=(altered[:,0]+1)%1024
 full,ctx=model.decode_s1(altered,b[:,:161],stamp[:,:161])
 cached,context=cache.decode_s1(altered,b[:,:161],stamp[:,:161])
 torch.testing.assert_close(cached,full[:,-1:],atol=2e-5,rtol=2e-5)
 torch.testing.assert_close(context,ctx,atol=2e-5,rtol=2e-5)
 original_s1,original_s2=model.decode_s1,model.decode_s2
 try:
  with CausalCache(model).install():
   raise RuntimeError('test restoration')
 except RuntimeError:
  pass
 assert model.decode_s1==original_s1 and model.decode_s2==original_s2
print('FUTURE_CACHE_PROOF '+json.dumps(result))
