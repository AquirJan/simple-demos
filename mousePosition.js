// author liangqj3 aquirjan@icloud.com
class mousePosition {
  constructor(options={}) {
    this.options = Object.assign({
      id: 'mousePosition'
    }, options);
    this.popEl = null;
    this.init()
    window.addEventListener('mousemove', ($event)=>this.move($event, this))
    return this.popEl;
  }
  detectSameId() {
    const _sameid = document.getElementById(this.options.id)
    if (_sameid) {
      return this.options.id+'_aj'
    } else {
      return this.options.id;
    }
  }
  init($event) {
    this.popEl = document.createElement('div')
    
    this.popEl.id = this.detectSameId()

    let popElDefaultStyle = {
      'position':'fixed',
      'background-color': 'rgba(38,38,38,0.9)',
      'opacity': 1,
      'color': '#fff',
      'border-radius':'4px',
      'box-shadow': '0 2px 8px 0 rgba(0,0,0,0.15)',
      'display': 'flex',
      'padding': '4px 8px',
      'z-index': 1000,
      'transition': `all ${this.options.animateDuration}`,
      'left': '0',
      'top': '0',
    }
    
    const _style = JSON.stringify(popElDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.popEl.style.cssText = _style
    this.popEl.innerText = `0, 0`
    document.body.appendChild(this.popEl)
    return this;
  }
  move($event, _this) {
    _this.popEl.innerText = `X: ${$event.clientX}, Y: ${$event.clientY}`;
  }
  
}