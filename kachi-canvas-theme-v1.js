/* ============================================================================
 * 孫悟空STOCK 9.1LX — KACHI × GOLD (勝色金箔風格介面) Universal Canvas Theme Engine
 * Automatically harmonizes ALL generated PNG reports across the web app to the
 * exact Kachi Indigo (#12162E) + Wa-Gold (#C9A23F / #E8CC7D) + Washi (#F4F1EA)
 * design system, while preserving Taiwan stock semantics (Red Up / Green Down)
 * and WCAG AA/AAA text contrast.
 * ============================================================================ */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SunWukongKachiCanvasTheme = api;
})(globalThis, function (root) {
  'use strict';

  const PALETTE = Object.freeze({
    bg: '#12162E',
    bgDeep: '#0D1024',
    card: '#181D3B',
    cardElevated: '#1F2549',
    hero: '#151A38',
    gold: '#C9A23F',
    goldLight: '#E8CC7D',
    goldBright: '#F6E2A1',
    goldBorder: 'rgba(201, 162, 63, 0.42)',
    goldGrid: 'rgba(201, 162, 63, 0.20)',
    washi: '#FFFFFF',
    washiSoft: '#F4F1EA',
    washiMuted: '#DCE0EA',
    skyLine: '#66B8FF',
    bull: '#FF7588',
    bullFill: 'rgba(255, 117, 136, 0.18)',
    bear: '#4FE0A8',
    bearFill: 'rgba(79, 224, 168, 0.18)',
    purple: '#D2BEFF',
  });

  function parseCssColor(input) {
    if (typeof input !== 'string') return null;
    const s = input.trim().toLowerCase();
    if (!s || s === 'transparent' || s === 'none') return null;

    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1,
        };
      }
      if (hex.length === 4) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: parseInt(hex[3] + hex[3], 16) / 255,
        };
      }
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
        };
      }
      return null;
    }

    const m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
    if (m) {
      return {
        r: Math.min(255, Math.max(0, Number(m[1]))),
        g: Math.min(255, Math.max(0, Number(m[2]))),
        b: Math.min(255, Math.max(0, Number(m[3]))),
        a: m[4] !== undefined ? Math.min(1, Math.max(0, Number(m[4]))) : 1,
      };
    }

    if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 };
    if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
    return null;
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function withAlpha(hex, alpha) {
    const c = parseCssColor(hex);
    if (!c) return hex;
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(alpha).toFixed(3)})`;
  }

  function classifyHue(h, s) {
    if (s < 0.14) return 'neutral';
    if (h >= 330 || h < 20) return 'red';
    if (h >= 20 && h < 66) return 'gold';
    if (h >= 66 && h < 172) return 'green';
    if (h >= 172 && h < 252) return 'blue';
    if (h >= 252 && h < 330) return 'purple';
    return 'neutral';
  }

  function mapColor(raw, role = 'fill') {
    const c = parseCssColor(raw);
    if (!c) return raw;
    const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
    const hue = classifyHue(h, s);

    // Subtle watermarks / ultra-transparent overlays -> warm gold tint
    if (c.a <= 0.22) {
      if (hue === 'red') return `rgba(242, 123, 138, ${c.a.toFixed(3)})`;
      if (hue === 'green') return `rgba(82, 209, 160, ${c.a.toFixed(3)})`;
      return `rgba(232, 204, 125, ${Math.min(c.a, role === 'text' ? 0.14 : 0.22).toFixed(3)})`;
    }

    if (role === 'text') {
      if (hue === 'red') return c.a < 1 ? withAlpha(PALETTE.bull, c.a) : PALETTE.bull;
      if (hue === 'green') {
        // Bearish greens (#086c57 h=167°, #00805f h=165°, #187044) stay crisp jade;
        // cyan-leaning heading teals (#056d68 h=177°) become restrained champagne gold accent!
        const target = h >= 171 ? PALETTE.goldLight : PALETTE.bear;
        return c.a < 1 ? withAlpha(target, c.a) : target;
      }
      if (hue === 'gold') return c.a < 1 ? withAlpha(PALETTE.goldBright, c.a) : PALETTE.goldBright;
      if (hue === 'purple') return c.a < 1 ? withAlpha(PALETTE.purple, c.a) : PALETTE.purple;
      if (hue === 'blue') {
        // High-legibility rule:
        // 1) Dark navy body ink (#17364e s=0.54, #24435e s=0.45, #152232) -> crisp pure WHITE (#FFFFFF)
        if (l <= 0.34 && s < 0.72) return PALETTE.washi;
        // 2) Any light blue-white body ink (#f0f6fb, #d8e9f5, #dfedf6) -> crisp pure WHITE (#FFFFFF)
        if (l >= 0.84) return PALETTE.washi;
        // 3) Muted slate/caption blue (#405f75, #526a7e, #71869c, #b8d9e9) -> bright silver-white (#DCE0EA)
        if (s < 0.56 || l >= 0.72) return PALETTE.washiMuted;
        // 4) ONLY vivid accent teal/blue (#056d68 s=0.91, #155cc0 s=0.80, #2581df, #22d3ee) -> restrained gold highlight
        return PALETTE.goldLight;
      }
      // Neutral text: dark or very light -> pure crisp WHITE; mid-gray -> bright silver-white
      if (l >= 0.34 && l <= 0.66) return PALETTE.washiMuted;
      return PALETTE.washi;
    }

    if (role === 'stroke') {
      if (hue === 'red') return c.a < 1 ? withAlpha(PALETTE.bull, c.a) : PALETTE.bull;
      if (hue === 'green') {
        const target = h >= 171 ? PALETTE.goldLight : PALETTE.bear;
        return c.a < 1 ? withAlpha(target, c.a) : target;
      }
      if (hue === 'gold') return c.a < 1 ? withAlpha(PALETTE.goldBright, c.a) : PALETTE.goldBright;
      if (hue === 'purple') return c.a < 1 ? withAlpha(PALETTE.purple, c.a) : PALETTE.purple;
      if (hue === 'blue') {
        // Pale chart gridlines (#cbdbe7, #dce5ec) -> subtle gold grid; card borders (#afcadc, #28627d) -> gold border
        if (l >= 0.82) return PALETTE.goldGrid;
        if (l >= 0.55 || s < 0.58) return PALETTE.goldBorder;
        // Vivid chart curves (MA20 / blue wave line / median blue line) -> luminous bright sky-blue for crystal-clear chart separation!
        return PALETTE.skyLine;
      }
      if (l >= 0.78) return PALETTE.goldGrid;
      return PALETTE.goldBorder;
    }

    // role === 'fill' (rectangles, rounded cards, chart bands, bars)
    if (hue === 'red') {
      if (l >= 0.85) return PALETTE.bullFill;
      return c.a < 1 ? withAlpha(PALETTE.bull, c.a) : PALETTE.bull;
    }
    if (hue === 'green') {
      if (l >= 0.85) return PALETTE.bearFill;
      if (h >= 170 && s < 0.55 && l < 0.30) return PALETTE.hero;
      return c.a < 1 ? withAlpha(PALETTE.bear, c.a) : PALETTE.bear;
    }
    if (hue === 'gold') {
      // Soft cream/amber highlight boxes (#fff8ec, #fffaf2, #fff8df) -> subtle gold wash
      if (l >= 0.85) return 'rgba(201, 162, 63, 0.13)';
      return c.a < 1 ? withAlpha(PALETTE.gold, c.a) : PALETTE.gold;
    }
    if (hue === 'purple') {
      if (l >= 0.85) return 'rgba(200, 176, 242, 0.16)';
      return c.a < 1 ? withAlpha(PALETTE.purple, c.a) : PALETTE.purple;
    }
    if (hue === 'blue') {
      // Fan chart translucent bands (#dbe8fb p10-p90, #adc9ee p25-p75) -> Champagne Gold bands!
      if (l >= 0.72 && l <= 0.84 && s >= 0.50) return 'rgba(232, 204, 125, 0.24)';
      if (l > 0.84 && l <= 0.93 && s >= 0.50) return 'rgba(201, 162, 63, 0.15)';
      // Very pale blue card fills (#f7fbff) -> Kachi card; tinted blue subcards (#e8f1f8, #f2f7fc) -> Kachi elevated
      if (l >= 0.96) return PALETTE.card;
      if (l >= 0.84) return PALETTE.cardElevated;
      // Dark navy/teal legacy backgrounds (#071f32, #0b1220, #10344f, #123a5a) -> Kachi Indigo
      if (l <= 0.14) return PALETTE.bg;
      if (l <= 0.26) return PALETTE.card;
      return PALETTE.cardElevated;
    }
    // Neutral fills
    if (l >= 0.96) return PALETTE.card;
    if (l >= 0.86) return PALETTE.cardElevated;
    if (l <= 0.16) return PALETTE.bg;
    if (l <= 0.28) return PALETTE.card;
    return PALETTE.cardElevated;
  }

  function installBrowserHook() {
    const Ctx = root.CanvasRenderingContext2D;
    if (!Ctx || !Ctx.prototype || Ctx.prototype.__kachiThemeInstalled) return;
    Ctx.prototype.__kachiThemeInstalled = true;

    const fillDesc = Object.getOwnPropertyDescriptor(Ctx.prototype, 'fillStyle');
    const strokeDesc = Object.getOwnPropertyDescriptor(Ctx.prototype, 'strokeStyle');
    if (!fillDesc || !strokeDesc) return;

    const stateMap = new WeakMap();
    const getState = (ctx) => {
      let st = stateMap.get(ctx);
      if (!st) {
        st = { fill: null, stroke: null, stack: [] };
        stateMap.set(ctx, st);
      }
      return st;
    };

    const isEligibleCanvas = (ctx) => {
      const c = ctx?.canvas;
      if (!c) return false;
      if (root.ShitouMarioTheme?.canvasActive(c)) return false;
      if (c.dataset?.kachiNative === '1') return false;
      return c.width >= 300 && c.height >= 200;
    };

    Object.defineProperty(Ctx.prototype, 'fillStyle', {
      configurable: true,
      enumerable: true,
      get() {
        return fillDesc.get.call(this);
      },
      set(val) {
        getState(this).fill = typeof val === 'string' ? val : null;
        fillDesc.set.call(this, val);
      },
    });

    Object.defineProperty(Ctx.prototype, 'strokeStyle', {
      configurable: true,
      enumerable: true,
      get() {
        return strokeDesc.get.call(this);
      },
      set(val) {
        getState(this).stroke = typeof val === 'string' ? val : null;
        strokeDesc.set.call(this, val);
      },
    });

    const origSave = Ctx.prototype.save;
    const origRestore = Ctx.prototype.restore;
    Ctx.prototype.save = function () {
      const st = getState(this);
      st.stack.push({ fill: st.fill, stroke: st.stroke });
      return origSave.call(this);
    };
    Ctx.prototype.restore = function () {
      const st = getState(this);
      const prev = st.stack.pop();
      if (prev) {
        st.fill = prev.fill;
        st.stroke = prev.stroke;
      }
      return origRestore.call(this);
    };

    // Map gradient stops on non-native canvases too
    const Grad = root.CanvasGradient;
    if (Grad && Grad.prototype && !Grad.prototype.__kachiGradInstalled) {
      Grad.prototype.__kachiGradInstalled = true;
      const origAddColorStop = Grad.prototype.addColorStop;
      Grad.prototype.addColorStop = function (offset, color) {
        const mapped = typeof color === 'string' && !this.__kachiNative ? mapColor(color, 'fill') : color;
        return origAddColorStop.call(this, offset, mapped);
      };
      const origLin = Ctx.prototype.createLinearGradient;
      const origRad = Ctx.prototype.createRadialGradient;
      Ctx.prototype.createLinearGradient = function (...args) {
        const g = origLin.apply(this, args);
        if (!isEligibleCanvas(this)) g.__kachiNative = true;
        return g;
      };
      Ctx.prototype.createRadialGradient = function (...args) {
        const g = origRad.apply(this, args);
        if (!isEligibleCanvas(this)) g.__kachiNative = true;
        return g;
      };
    }

    const origFillRect = Ctx.prototype.fillRect;
    Ctx.prototype.fillRect = function (x, y, w, h) {
      if (!isEligibleCanvas(this)) return origFillRect.call(this, x, y, w, h);
      const st = getState(this);
      const raw = st.fill;
      const cw = this.canvas.width;
      const ch = this.canvas.height;

      // Full-canvas backdrop -> Kachi Indigo gradient + subtle gold top radiance + outer gold hairline
      if (raw && x <= 2 && y <= 2 && w >= cw * 0.96 && h >= ch * 0.96) {
        origSave.call(this);
        const bg = origLinBg(this, cw, ch);
        fillDesc.set.call(this, bg);
        origFillRect.call(this, x, y, w, h);
        const glow = origRadGlow(this, cw);
        fillDesc.set.call(this, glow);
        origFillRect.call(this, 0, 0, cw, Math.min(ch, 560));
        strokeDesc.set.call(this, 'rgba(201, 162, 63, 0.34)');
        this.lineWidth = 3;
        origStrokeRect.call(this, 8, 8, cw - 16, ch - 16);
        origRestore.call(this);
        return;
      }

      // Wide top hero banner -> Kachi Royal Indigo + gold foil bottom rule
      if (raw && y <= 16 && w >= cw * 0.85 && h >= 80 && h <= 420) {
        const c = parseCssColor(raw);
        const hsl = c ? rgbToHsl(c.r, c.g, c.b) : null;
        if (hsl && hsl.l < 0.38) {
          origSave.call(this);
          fillDesc.set.call(this, PALETTE.hero);
          origFillRect.call(this, x, y, w, h);
          fillDesc.set.call(this, PALETTE.gold);
          origFillRect.call(this, x, y + h - 3, w, 3);
          origRestore.call(this);
          return;
        }
      }

      if (raw) {
        // Hollow candle body fill (small rect with warm cream '#fff8ec') -> deep Kachi interior
        const mapped = w <= 22 && h <= 220 && raw.toLowerCase() === '#fff8ec' ? PALETTE.bgDeep : mapColor(raw, 'fill');
        fillDesc.set.call(this, mapped);
      }
      return origFillRect.call(this, x, y, w, h);
    };

    function origLinBg(ctx, cw, ch) {
      const g = Ctx.prototype.createLinearGradient.call(ctx, 0, 0, 0, ch);
      g.__kachiNative = true;
      g.addColorStop(0, '#161B38');
      g.addColorStop(0.48, '#12162E');
      g.addColorStop(1, '#0D1024');
      return g;
    }
    function origRadGlow(ctx, cw) {
      const g = Ctx.prototype.createRadialGradient.call(ctx, cw * 0.5, 0, 30, cw * 0.5, 0, cw * 0.65);
      g.__kachiNative = true;
      g.addColorStop(0, 'rgba(201, 162, 63, 0.16)');
      g.addColorStop(1, 'rgba(201, 162, 63, 0)');
      return g;
    }

    const origFill = Ctx.prototype.fill;
    Ctx.prototype.fill = function (...args) {
      if (isEligibleCanvas(this)) {
        const raw = getState(this).fill;
        if (raw) fillDesc.set.call(this, mapColor(raw, 'fill'));
      }
      return origFill.apply(this, args);
    };

    const origFillText = Ctx.prototype.fillText;
    Ctx.prototype.fillText = function (...args) {
      if (isEligibleCanvas(this)) {
        const raw = getState(this).fill;
        if (raw) fillDesc.set.call(this, mapColor(raw, 'text'));
      }
      return origFillText.apply(this, args);
    };

    const origStroke = Ctx.prototype.stroke;
    Ctx.prototype.stroke = function (...args) {
      if (isEligibleCanvas(this)) {
        const raw = getState(this).stroke;
        if (raw) strokeDesc.set.call(this, mapColor(raw, 'stroke'));
      }
      return origStroke.apply(this, args);
    };

    const origStrokeRect = Ctx.prototype.strokeRect;
    Ctx.prototype.strokeRect = function (...args) {
      if (isEligibleCanvas(this)) {
        const raw = getState(this).stroke;
        if (raw) strokeDesc.set.call(this, mapColor(raw, 'stroke'));
      }
      return origStrokeRect.apply(this, args);
    };

    const origStrokeText = Ctx.prototype.strokeText;
    Ctx.prototype.strokeText = function (...args) {
      if (isEligibleCanvas(this)) {
        const raw = getState(this).stroke;
        if (raw) strokeDesc.set.call(this, mapColor(raw, 'stroke'));
      }
      return origStrokeText.apply(this, args);
    };
  }

  if (typeof root.window !== 'undefined') {
    installBrowserHook();
  }

  return Object.freeze({
    PALETTE,
    parseCssColor,
    mapColor,
    installBrowserHook,
  });
});
