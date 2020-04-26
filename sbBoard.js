class sbBoard {
  constructor(options) {
    this.options = Object.assign({
      width: window.innerWidth,
      height: window.innerHeight,
      style: {
        'border': '1px solid black'
      }
    }, options);
    this.sbCtx = null;
    this.sbDom = null;
    this.drawing = false;
    this.pencilPosition = {
      x: 0,
      y: 0
    }
    this.drawType = 'line'
    this.imgData = null;
    this.zoomSize = 1;
    this.fakepd = (e) => {
      this.pencilDown(e)
    }
    this.fakepm = (e) => {
      this.pencilMove(e)
    }
    this.fakepu = (e) => {
      this.pencilUp(e)
    }
    return this.init()
  }
  // 初始化
  init() {
    this.sbDom = document.createElement('canvas')
    this.sbDom.width = this.options.width
    this.sbDom.height = this.options.height
    let popElDefaultStyle = {}
    if (this.options.style.constructor === Object) {
      popElDefaultStyle = Object.assign(popElDefaultStyle, this.options.style)
    } else {
      console.warn('style must be an object type')
    }
    this.sbDom.style.cssText = JSON.stringify(popElDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.sbCtx = this.sbDom.getContext('2d')
    this.sbDom.addEventListener('mousedown', this.fakepd, false)
    return this;
  }
  // 获取画布dom
  getCanavasDom() {
    return this.sbDom;
  }
  // 获取画布ctx对象
  getCanavasCtx() {
    return this.sbCtx;
  }
  // 保存整个画布数据
  saveImageData() {
    this.imgData = this.sbCtx.getImageData(0, 0, this.sbDom.width, this.sbDom.height)
  }
  // 重绘整个画布数据
  restoreImageData() {
    console.log('restore image data class')
    this.sbCtx.putImageData(this.imgData, 0, 0)
  }
  // 工具栏用方法
  // 清除
  clearWhole() {
    console.log('clear whole class')
    this.sbCtx.clearRect(0, 0, this.sbDom.width, this.sbDom.height)
  }
  // 放大
  zoomIn() {
    this.saveImageData()
    console.log(this.imgData)
    // this.clearWhole()
    // this.zoomSize = this.zoomSize + 1;
    // console.log(this.zoomSize)
    // this.sbCtx.scale(this.zoomSize, this.zoomSize);
    this.restoreImageData()
  }
  // 缩小
  zoomOut() {
    this.saveImageData()
    this.clearWhole()
    this.zoomSize = this.zoomSize - 1;
    this.sbCtx.scale(this.zoomSize, this.zoomSize);
    this.restoreImageData()
  }
  // 工具栏用方法end
  // 设置画图类型
  setDrawType(params) {
    this.drawType = params;
  }
  // 设定当前画笔坐标
  setPencilPosition(x, y) {
    this.pencilPosition.x = x - this.sbDom.offsetLeft;
    this.pencilPosition.y = y - this.sbDom.offsetTop;
  }
  // 画笔下笔事件方法
  pencilDown(e) {
    if (this.drawing) {
      return;
    }
    this.drawing = true;
    this.setPencilPosition(e.clientX, e.clientY)
    this.sbCtx.moveTo(this.pencilPosition.x, this.pencilPosition.y);
    this.sbCtx.beginPath();
    this.sbCtx.strokeStyle="red";
    this.sbCtx.lineWidth = 1;
    switch(this.drawType) {
      case "line":
        this.sbCtx.lineTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.stroke();
        break;
      case "beeline":
        this.saveImageData()
        break;
      default:
        return;
    }
    document.body.addEventListener('mousemove', this.fakepm, false)
    document.body.addEventListener('mouseup', this.fakepu, false)
    document.body.addEventListener('mouseleave', this.fakepu, false)
    
  }
  // 画笔移动事件方法
  pencilMove(e) {
    if (!this.drawing) {
      return;
    }
    this.setPencilPosition(e.clientX, e.clientY)
    switch(this.drawType) {
      case "line":
        this.sbCtx.lineTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.stroke();
        break;
      case "beeline":
        this.sbCtx.lineTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.stroke();
        break;
      case "rect":
        this.sbCtx.lineTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.stroke();
        break;
      default:
        return;
    }
  }
  // 画笔收笔方法
  pencilUp(e) {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    this.setPencilPosition(e.clientX, e.clientY)
    switch(this.drawType) {
      case "line":
        this.sbCtx.lineTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.stroke();
        break;
      case "beeline":
        this.sbCtx.lineTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.stroke();
        break;
      default:
        return;
    }
    this.sbCtx.closePath()

    document.body.removeEventListener('mousemove', this.fakepm, false)
    document.body.removeEventListener('mouseup', this.fakepu, false)
    document.body.removeEventListener('mouseleave', this.fakepu, false)
  }
}