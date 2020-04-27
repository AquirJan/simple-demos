class sbBoard {
  constructor(options) {
    this.options = Object.assign({
      width: window.innerWidth,
      height: window.innerHeight,
      style: {},
      wrapStyle: {},
      drawHistory: []
    }, options);
    this.sbCtx = null;
    this.sbDom = null;
    this.sbWrap = null;
    this.reInitHandler = null;
    this.drawing = false;
    this.moveTimeTtamp = 0;
    this.clickTimeLogs = [];
    this.bgObj = null;
    this.pencilPosition = {
      x: 0,
      y: 0
    }
    this.drawType = 'rect'; // rect, line, polygon
    this.tmpPolygon = null // 存放临时 polygon 对象用
    this.imgData = null;
    this.zoomSize = 1;
    this.drawRectsHistory = []
    this.selectedDraw = null;
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
    this.sbWrap = document.createElement('div');
    this.sbDom = document.createElement('canvas')
    this.sbDom.width = this.options.width
    this.sbDom.height = this.options.height
    let wrapDefaultStyle = {
      'user-select': 'none',
      'width': this.options.width+'px',
      'height': this.options.height+'px',
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center'
    }
    let canvasDefaultStyle = {
      'user-select': 'none',
    }
    if (this.options.wrapStyle.constructor === Object) {
      wrapDefaultStyle = Object.assign(wrapDefaultStyle, this.options.wrapStyle)
    } else {
      console.warn('wrapStyle must be an object type')
    }
    if (this.options.style.constructor === Object) {
      canvasDefaultStyle = Object.assign(canvasDefaultStyle, this.options.style)
    } else {
      console.warn('style must be an object type')
    }
    this.sbDom.style.cssText = JSON.stringify(canvasDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.sbWrap.style.cssText = JSON.stringify(wrapDefaultStyle).replace(/"*,"/gi, ";").replace(/({)|(})|(")/gi, "");
    this.sbCtx = this.sbDom.getContext('2d')
    this.sbCtx.strokeStyle = '#333'
    this.sbCtx.lineWidth = 2
    
    this.sbWrap.appendChild(this.sbDom)

    this.drawRectsHistory = this.options.drawHistory;
    this.renderBoard()
    return this;
  }
  // 销毁
  destroy() {
    this.sbWrap.remove()
  }
  // 获取画布dom
  getCanavasDom() {
    return this.sbDom;
  }
  // 获取容器dom
  getWrapDom() {
    return this.sbWrap;
  }
  // 设置背景图
  async setBackgroundImage(src) {
    this.bgObj = await this.asyncLoadImage(src)
    this.renderBoard()
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
  // 加载背景图
  asyncLoadImage(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve({
          success: false,
          msg: 'no src'
        })
      }
      const image = new Image();
      image.src = src;
      image.onload = () => {
        resolve({
          success: true,
          msg: 'load image complite',
          data: image,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }
      image.onerror = () => {
        resolve({
          success: false,
          msg: 'load image error'
        })
      }
    })
  }
  // 绘画背景图
  async drawBackground() {
    if (this.bgObj) {
      const { height, width } = this.calcImageSize()
      this.sbDom.width = width
      this.sbDom.height = height
      this.sbCtx.drawImage(this.bgObj.data, 0, 0, width, height)
    }
  }
  // 工具栏用方法
  // 清除
  clearWhole(publicUse = true) {
    if (publicUse) {
      this.drawRectsHistory = []
    }
    this.sbCtx.clearRect(0, 0, this.sbDom.width, this.sbDom.height)
  }
  // 放大
  zoomIn() {
    // console.log(this.imgData)
    // this.clearWhole(false)
    // this.zoomSize = this.zoomSize + 1;
    // console.log(this.zoomSize)
    // this.sbCtx.scale(this.zoomSize, this.zoomSize);
  }
  // 缩小
  zoomOut() {
    this.clearWhole(false)
    this.zoomSize = this.zoomSize - 1;
    this.sbCtx.scale(this.zoomSize, this.zoomSize);
  }
  // 工具栏用方法end
  // 设置画图类型
  setDrawType(params) {
    this.drawRectsHistory.forEach(val => {
      val['selected'] = false;
    })
    this.drawType = params;
    this.sbDom.addEventListener('mousedown', this.fakepd, false)
  }
  // 设定当前画笔坐标
  setPencilPosition(x, y) {
    this.pencilPosition.x = x - this.sbDom.offsetLeft;
    this.pencilPosition.y = y - this.sbDom.offsetTop;
  }
  // 获取起点与终点尺寸
  getDeltaSize(x, y) {
    return {width : x - this.sbDom.offsetLeft - this.pencilPosition.x, height: y - this.sbDom.offsetTop - this.pencilPosition.y};
  }
  // 获取终点坐标
  getDeltaPosition(x, y) {
    return {x : x - this.sbDom.offsetLeft, y: y - this.sbDom.offsetTop};
  }
  // 调整控点
  adjustmentDot(x, y) {
    this.sbCtx.beginPath()
    this.sbCtx.arc(x, y, 4, 0, 2*Math.PI);
    this.sbCtx.closePath()
    this.sbCtx.stroke();
  }
  // 调整框框插件
  adjustmentAddon() {
    const item = this.drawRectsHistory.find(val => {
      return val.selected
    })
    if (!item) {
      this.selectedDraw = null;
      return;
    }
    this.selectedDraw = item
    this.sbCtx.strokeStyle = 'red'
    this.sbCtx.lineWidth = 2
    if (item.type === 'line') {
      this.adjustmentDot(item.x, item.y)
      this.adjustmentDot(item.dx, item.dy)
    } else {
      this.adjustmentDot(item.x, item.y)
      this.adjustmentDot(item.x, item.y+item.height)
      this.adjustmentDot(item.x, item.y+item.height/2)
      this.adjustmentDot(item.x+item.width, item.y)
      this.adjustmentDot(item.x+item.width/2, item.y)
      this.adjustmentDot(item.x+item.width, item.y+item.height)
      this.adjustmentDot(item.x+item.width, item.y+item.height/2)
      this.adjustmentDot(item.x+item.width/2, item.y+item.height)
    }
  }
  initPencilStyle() {
    this.sbCtx.strokeStyle = '#333'
    this.sbCtx.lineWidth = 2
  }
  // 绘制画面
  renderBoard() {
    this.clearWhole(false)
    this.initPencilStyle()
    this.sbCtx.fillStyle = '#878'
    this.sbCtx.fillRect(0, 0, this.sbDom.width, this.sbDom.height)
    this.drawBackground()
    this.drawRectsHistory.forEach(val => {
      switch (val.type) {
        case 'polygon':
          this.sbCtx.beginPath();
          this.sbCtx.moveTo(val.x, val.y);
          if (val.way) {
            val.way.forEach(wval => {
              this.sbCtx.lineTo(wval.x, wval.y);
            })
          }
          this.sbCtx.lineTo(val.dx, val.dy);
          this.sbCtx.closePath();
          this.sbCtx.stroke();
          break;
        case 'line':
          this.sbCtx.beginPath();
          this.sbCtx.moveTo(val.x, val.y);
          this.sbCtx.lineTo(val.dx, val.dy);
          this.sbCtx.stroke();
          break;
        case 'rect':
          this.sbCtx.strokeRect(val.x, val.y, val.width, val.height);
          break;
        default:
      }
    })
    if (this.tmpPolygon) {
      this.sbCtx.beginPath();
      this.sbCtx.moveTo(this.tmpPolygon.x, this.tmpPolygon.y);
      if (this.tmpPolygon.way) {
        this.tmpPolygon.way.forEach(wval => {
          this.sbCtx.lineTo(wval.x, wval.y);
        })
      }
      this.sbCtx.lineTo(this.tmpPolygon.dx, this.tmpPolygon.dy);
      this.sbCtx.stroke();
    }
    this.adjustmentAddon()
  }
  // 画笔下笔事件方法
  pencilDown(e) {
    this.sbDom.removeEventListener('mousemove', this.fakepm, false)
    if (this.drawType === 'pointer') {
      console.log('pointer down')
      return;
    }
    if (this.drawType === 'polygon') {
      this.setPencilPosition(e.clientX, e.clientY)
    } else {
      if (this.drawing) {
        return;
      }
      this.drawing = true;
      this.setPencilPosition(e.clientX, e.clientY)

      document.body.addEventListener('mouseleave', this.fakepu, false)
    } 
    document.body.addEventListener('mousemove', this.fakepm, false)
    document.body.addEventListener('mouseup', this.fakepu, false)
    
    
  }
  // 画笔移动事件方法
  pencilMove(e) {
    if (this.drawType === 'pointer') {
      if (this.selectedDraw && this.calcMouseIsInsideSelectedDraw(e)) {
        document.body.style.cursor = 'move'
      } else {
        document.body.style.cursor = 'default'
      }
      return;
    }
    if (this.tmpPolygon && this.drawType === 'polygon') {
      this.renderBoard()
      const _dp = this.getDeltaPosition(e.clientX, e.clientY)
      const _ds = this.getDeltaSize(e.clientX, e.clientY)
      this.sbCtx.beginPath()
      
      this.sbCtx.moveTo(this.pencilPosition.x, this.pencilPosition.y);
      this.sbCtx.lineTo(_dp.x, _dp.y);
      this.sbCtx.stroke()
    } else {
      if (!this.drawing) {
        return;
      }
      this.renderBoard()
      this.drawSomeOne({
        x: e.clientX,
        y: e.clientY
      })
    }
  }
  // 画笔收笔方法
  pencilUp(e) {
    if (this.drawType === 'pointer') {
      return;
    }
    if (this.drawType !== 'polygon') {
      if (!this.drawing) {
        return;
      }
      this.drawing = false;
      const someOneRect = this.drawSomeOne({
        x: e.clientX,
        y: e.clientY
      })
      console.log(someOneRect)
      if (someOneRect.width > 20 || someOneRect.height > 20)  {
        // 记录已经画的rects
        someOneRect['id'] = this.generateUUID()
        someOneRect['selected'] = true
        this.drawRectsHistory.push(someOneRect)
      }
      
      this.renderBoard()
      this.setDrawType('pointer')
      document.body.removeEventListener('mousemove', this.fakepm, false)
      document.body.removeEventListener('mouseup', this.fakepu, false)
      document.body.removeEventListener('mouseleave', this.fakepu, false)

      this.sbDom.addEventListener('mousemove', this.fakepm, false)
    } else {
      if (!this.tmpPolygon) {
        this.tmpPolygon = {
          x: this.pencilPosition.x,
          y: this.pencilPosition.y,
          type: this.drawType,
          id: this.generateUUID(),
          closed: false
        }
      } else {
        if (this.detectIsDBClick(e.timeStamp)) {
          this.tmpPolygon['closed'] = true;
          this.tmpPolygon.way.push({
            x: this.tmpPolygon.x,
            y: this.tmpPolygon.y
          })
          this.drawRectsHistory.push(this.tmpPolygon)
          this.setDrawType('pointer')
          this.tmpPolygon = null;
          this.renderBoard()
          document.body.removeEventListener('mousemove', this.fakepm, false)
          document.body.removeEventListener('mouseup', this.fakepu, false)
          document.body.removeEventListener('mouseleave', this.fakepu, false)
          return;
        }
        const _dp = this.getDeltaPosition(e.clientX, e.clientY)
        const _wayDot = {
          x: _dp.x,
          y: _dp.y
        };
        if (this.detectTwoPointClose(this.tmpPolygon, _wayDot)) {
          this.tmpPolygon['closed'] = true;
          this.drawRectsHistory.push(this.tmpPolygon)
          this.tmpPolygon = null;
          document.body.removeEventListener('mousemove', this.fakepm, false)
          document.body.removeEventListener('mouseup', this.fakepu, false)
          document.body.removeEventListener('mouseleave', this.fakepu, false)
        } else {
          this.tmpPolygon['way'] = this.tmpPolygon.way ? this.tmpPolygon['way'] : []
          this.tmpPolygon['way'].push(_wayDot)
        }
      }
    }
  }
  calcMouseIsInsideSelectedDraw(e) {
    let _final = false;
    if (this.selectedDraw && e) {
      switch(this.selectedDraw.type) {
        case "rect":
          const cx = e.clientX - this.sbDom.offsetLeft;
          const cy = e.clientY - this.sbDom.offsetTop;
          let flagX = false;
          let flagY = false;
          if (cx >= this.selectedDraw.x && cx <= this.selectedDraw.dx) {
            flagX = true;
          }
          if (cy >= this.selectedDraw.y && cy <= this.selectedDraw.dy) {
            flagY = true;
          }
          _final = flagX && flagY;
          break;
      }
    }
    return _final;
  }
  // 计算图片显示宽高
  calcImageSize() {
    let _obj = {
      width: 0,
      height: 0
    }
    if (this.bgObj) {
      _obj.width = Math.round(this.bgObj.width * (this.sbDom.height/this.bgObj.height))
      if (_obj.width > this.sbDom.width) {
        _obj.width = this.sbDom.width
        _obj.height = Math.round(this.bgObj.height * (this.sbDom.width/this.bgObj.width))
      } else {
        _obj.height = this.sbDom.height
      }
    }
    return _obj
  }
  // 检验是否双击
  detectIsDBClick(ctime) {
    this.clickTimeLogs.unshift(ctime)
    if (this.clickTimeLogs.length > 2) {
      this.clickTimeLogs = this.clickTimeLogs.slice(0, 2)
    }
    if (this.clickTimeLogs.length !== 2) {
      return false;
    }
    const _deltaTime = Math.abs(this.clickTimeLogs[0] - this.clickTimeLogs[1])
    
    if (_deltaTime <= 200) {
      return true;
    } else {
      return false;
    }
  }
  // 产生id
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }
  // 判断两点是否接近 
  detectTwoPointClose(reference, point) {
    let flagX = false;
    let flagY = false;
    if (point.x <= reference.x + 5 && point.x >= reference.x - 5) {
      flagX = true;
    }
    if (point.y <= reference.y + 5 && point.y >= reference.y - 5) {
      flagY = true;
    }
    if (flagX && flagY) {
      return true;
    } else {
      return false;
    }
  }
  // 绘画线和矩形
  drawSomeOne(currentPoint={x:0,y:0}, drawType) {
    const _dt = drawType || this.drawType;
    const _dp = this.getDeltaPosition(currentPoint.x, currentPoint.y)
    const _ds = this.getDeltaSize(currentPoint.x, currentPoint.y)
    switch(_dt) {
      case 'line':
        this.sbCtx.beginPath();
        this.sbCtx.moveTo(this.pencilPosition.x, this.pencilPosition.y);
        this.sbCtx.lineTo(_dp.x, _dp.y);
        this.sbCtx.stroke();
        break;
      case 'rect':
      default:
        this.sbCtx.strokeRect(this.pencilPosition.x, this.pencilPosition.y, _ds.width, _ds.height);
    }
    return {
      x: this.pencilPosition.x,
      y: this.pencilPosition.y,
      dx: _dp.x,
      dy: _dp.y,
      // way: [],
      width: _ds.width,
      height: _ds.height,
      type: this.drawType,
      // selected: false,
      // closed: false
    }
  }
}