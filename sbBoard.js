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
    this.adjustSize = false;
    this.reInitHandler = null;
    this.pencilPressing = false; // 是否画笔按压状态
    this.tinkerUp = null; // 是否处于调整尺寸状态
    this.moveTimeTtamp = 0;
    this.clickTimeLogs = [];
    this.bgObj = null;
    this.pencilPosition = null;
    // this.pencilOverPosition = {
    //   x: 0,
    //   y: 0
    // };
    this.drawType = 'rect'; // rect, line, polygon
    this.tmpPolygon = null // 存放临时 polygon 对象用
    this.tmpRect = null;
    this.imgData = null;
    this.zoomSize = 1;
    this.drawsHistory = []
    this.controlDotsPath = []
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
    this.sbWrap.appendChild(this.sbDom)
    this.drawsHistory = this.options.drawHistory;

    this.sbDom.addEventListener('mousedown', this.fakepd, false)
    this.sbDom.addEventListener('mousemove', this.fakepm, false)
    this.sbDom.addEventListener('mouseup', this.fakepu, false)

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
  // 获取画布ctx对象
  getCanavasCtx() {
    return this.sbCtx;
  }
  // 设置背景图
  async setBackground(obj) {
    const _obj = Object.assign({
      color: '#878',
      src: ''
    }, obj)
    if (_obj.src) {
      this.bgObj = await this.asyncLoadImage(_obj.src)  
    } else {
      this.sbCtx.fillStyle = _obj.color
    }
    this.renderBoard()
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
  async drawBackgroundImage() {
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
      this.drawsHistory = []
      this.selectedDraw = null;
      this.bgObj = null;
    }
    this.sbCtx.fillStyle = '#878'
    this.sbCtx.fillRect(0, 0, this.sbDom.width, this.sbDom.height)
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
    this.drawsHistory.forEach(val => {
      val['selected'] = false;
    })
    this.drawType = params;
  }
  // 设定画笔点击坐标
  setPencilPosition(x, y) {
    this.pencilPosition = {
      x: x,
      y: y
    }
  }
  // 设置当前画笔悬停位置
  // setPencilOverPosition(x, y) {
  //   this.pencilOverPosition = {
  //     x: x,
  //     y: y
  //   }
  // }
  // 获取起点与终点之间的尺寸
  getDeltaSize(x, y) {
    return {width : x - this.pencilPosition.x, height: y - this.pencilPosition.y};
  }
  // 生成调整控点
  generateAdjustmentDot(x, y) {
    const circle = new Path2D();
    circle.arc(x, y, 6, 0, 2*Math.PI);
    return circle;
  }
  // 保存选中的框框到临时对象
  setSelectedDraw() {
    this.selectedDraw = null;
    for(let i=0;i<this.drawsHistory.length;i++) {
      if (this.drawsHistory[i].selected) {
        this.selectedDraw = {
          data: JSON.parse(JSON.stringify(this.drawsHistory[i])),
          // data: this.drawsHistory.slice(i, i+1),
          index: i
        }
        break;
      }
    }
  }
  // 调整框框插件
  adjustmentAddon() {
    if (!this.selectedDraw) {
      return;
    }
    
    const item = this.drawsHistory[this.selectedDraw.index];
    this.controlDotsPath = [
      {
        path: this.generateAdjustmentDot(item.x, item.y), 
        cursor: 'nwse-resize',
        code: 'tl',
      },
      {
        path: this.generateAdjustmentDot(item.x+item.width/2, item.y),
        cursor: 'ns-resize',
        code: 'tm',
      },
      {
        path: this.generateAdjustmentDot(item.x+item.width, item.y),
        cursor: 'nesw-resize',
        code: 'tr',
      },
      {
        path: this.generateAdjustmentDot(item.x+item.width, item.y+item.height/2),
        cursor: 'ew-resize',
        code: 'rm',
      },
      {
        path: this.generateAdjustmentDot(item.x+item.width, item.y+item.height),
        cursor: 'nwse-resize',
        code: 'br',
      },
      {
        path: this.generateAdjustmentDot(item.x+item.width/2, item.y+item.height),
        cursor: 'ns-resize',
        code: 'bm',
      },
      {
        path: this.generateAdjustmentDot(item.x, item.y+item.height),
        cursor: 'nesw-resize',
        code: 'bl',
      },
      {
        path: this.generateAdjustmentDot(item.x, item.y+item.height/2),
        cursor: 'ew-resize',
        code: 'lm',
      }
    ]
    this.sbCtx.fillStyle = '#2ac2e4';
    this.controlDotsPath.forEach(val => {
      this.sbCtx.fill(val.path);
    })
  }
  initPencilStyle() {
    this.sbCtx.strokeStyle = '#333'
    this.sbCtx.lineWidth = 3
  }
  // 绘制画面
  renderBoard() {
    this.clearWhole(false)
    // 设置背景图
    this.drawBackgroundImage()
    this.initPencilStyle()
    this.drawsHistory.forEach(val => {
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
    switch (this.drawType) {
      case "pointer":
        this.selectedDraw = JSON.parse(JSON.stringify(this.calcIsOnDrawPath(e.offsetX, e.offsetY)))
        
        if (this.selectedDraw) {
          for(let i=0;i<this.controlDotsPath.length;i++) {
            if (this.sbCtx.isPointInPath(this.controlDotsPath[i].path, e.offsetX, e.offsetY)) {
              document.body.style.cursor = this.controlDotsPath[i].cursor;
              this.tinkerUp = this.controlDotsPath[i].code;
              break;
            }
          }
        }
        console.log(this.tinkerUp)
        if (this.calcIsInsideDraw(e.offsetX, e.offsetY) || this.selectedDraw || this.tinkerUp) {
          if (this.pencilPressing) {
            return;
          }
          this.pencilPressing = true;
          this.setPencilPosition(e.offsetX, e.offsetY)
        }
        
        
        this.renderBoard()
        break;
      case "rect":
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(e.offsetX, e.offsetY)
        break;
    }
  }
  // 画笔移动事件方法
  pencilMove(e) {
    // this.setPencilOverPosition(e.offsetX, e.offsetY)
    // console.log(this.drawType)
    switch (this.drawType) {
      case "pointer":
        // console.log(this.pencilPressing)
        if (!this.pencilPressing) {
          if (!this.pencilPosition) {
            document.body.style.cursor = this.calcIsOnDrawPath(e.offsetX, e.offsetY) || this.calcIsInsideDraw() ? 'move' : 'default'
            if (this.selectedDraw) {
              for(let i=0;i<this.controlDotsPath.length;i++) {
                if (this.sbCtx.isPointInPath(this.controlDotsPath[i].path, e.offsetX, e.offsetY)) {
                  document.body.style.cursor = this.controlDotsPath[i].cursor;
                  break;
                }
              }
            }
          }
        } else {
          // console.log('pressing')
          if (this.selectedDraw) {
            // console.log(this.tinkerUp)
            if (this.tinkerUp) {
              // console.log('调整尺寸')
              // 调整尺寸
              const _sditem = this.selectedDraw.data;
              const _ds = this.getDeltaSize(e.offsetX, e.offsetY)
              let _item = this.drawsHistory[this.selectedDraw.index];
              _item.selected = true;
              
              switch(this.tinkerUp) {
                case "bm":
                  _item.height = _sditem.height + _ds.height
                  _item.dy = _sditem.dy + _ds.height
                  break;
                case "rm":
                  _item.width = _sditem.width + _ds.width
                  _item.dx = _sditem.dx + _ds.width
                  break;
                case "br":
                  _item.height = _sditem.height + _ds.height
                  _item.dy = _sditem.dy + _ds.height
                  _item.width = _sditem.width + _ds.width
                  _item.dx = _sditem.dx + _ds.width
                  break;
                case "tm":
                  _item.height = _sditem.height - _ds.height
                  _item.y = _sditem.y + _ds.height
                  break;
                case "lm":
                  _item.width = _sditem.width - _ds.width
                  _item.x = _sditem.x + _ds.width
                  break;
                case "tl":
                  _item.height = _sditem.height - _ds.height
                  _item.y = _sditem.y + _ds.height
                  _item.width = _sditem.width - _ds.width
                  _item.x = _sditem.x + _ds.width
                  break;
                case "tr":
                  _item.width = _sditem.width + _ds.width
                  _item.dx = _sditem.dx + _ds.width
                  _item.height = _sditem.height - _ds.height
                  _item.y = _sditem.y + _ds.height
                  break;
                case "bl":
                  _item.height = _sditem.height + _ds.height
                  _item.dy = _sditem.dy + _ds.height
                  _item.width = _sditem.width - _ds.width
                  _item.x = _sditem.x + _ds.width
                  break;
              }
              // console.log(_item)
            } else {
              // 整体移动
              const _sditem = this.selectedDraw.data;
              const _ds = this.getDeltaSize(e.offsetX, e.offsetY)
              let _item = this.drawsHistory[this.selectedDraw.index];
              _item.selected = true;
              _item.x = _sditem.x + _ds.width
              _item.y = _sditem.y + _ds.height
              _item.dx = _sditem.dx + _ds.width
              _item.dy = _sditem.dy + _ds.height
            }
            
            this.renderBoard()
          }
        }
        
        break;
      case "polygon":
        // console.log(this.pencilPosition)
        // if (this.tmpPolygon && this.pencilPosition) {
        //   this.renderBoard()
        //   const _dp = this.getDestinationPosition(e.clientX, e.clientY)
        //   const _ds = this.getDeltaSize(e.clientX, e.clientY)
        //   this.sbCtx.beginPath()
          
        //   this.sbCtx.moveTo(this.pencilPosition.x, this.pencilPosition.y);
        //   this.sbCtx.lineTo(_dp.x, _dp.y);
        //   this.sbCtx.stroke()
        // }
        break;
      case 'rect':
        if (!this.pencilPressing) {
          return;
        }
        this.renderBoard()
        this.drawRect(e.offsetX, e.offsetY)
        break;
    }
  }
  // 画笔收笔方法
  pencilUp(e) {
    switch (this.drawType) {
      case "pointer":
        if (this.pencilPressing) {
          if (this.selectedDraw) {
            this.selectedDraw.data = JSON.parse(JSON.stringify(this.drawsHistory[this.selectedDraw.index]))
            this.selectedDraw.data = this.finalRectAdjustment(this.selectedDraw.data)
            this.drawsHistory[this.selectedDraw.index] = this.selectedDraw.data
          }
          
          // this.selectedDraw['data'] = this.drawsHistory.slice(this.selectedDraw.index, this.selectedDraw.index+1)
          this.pencilPressing = false;
          this.tinkerUp = null;
        }
        
        this.pencilPosition = null;
        this.renderBoard()
        
        break;
      case "rect":
        
        this.pencilPressing = false;
        let someOneRect = this.drawRect(e.offsetX, e.offsetY)
        
        someOneRect = this.finalRectAdjustment(someOneRect)

        if (someOneRect.width > 20 || someOneRect.height > 20)  {
          // 记录已经画的rects
          someOneRect['id'] = this.generateUUID()
          someOneRect['selected'] = true
          this.drawsHistory.push(someOneRect)
          this.setSelectedDraw()
        }
        console.log(someOneRect)
        this.renderBoard()
        this.setDrawType('pointer')
        this.pencilPosition = null;
        break;
      // case "polygon":
        // if (!this.tmpPolygon) {
        //   this.tmpPolygon = {
        //     x: this.pencilPosition.x,
        //     y: this.pencilPosition.y,
        //     type: this.drawType,
        //     id: this.generateUUID(),
        //     closed: false
        //   }
        // } else {
        //   if (this.detectIsDBClick(e.timeStamp)) {
        //     this.tmpPolygon['closed'] = true;
        //     this.tmpPolygon.way.push({
        //       x: this.tmpPolygon.x,
        //       y: this.tmpPolygon.y
        //     })
        //     this.drawsHistory.push(this.tmpPolygon)
        //     this.setDrawType('pointer')
        //     this.tmpPolygon = null;
        //     this.renderBoard()
        //     return;
        //   }
        //   const _dp = this.getDestinationPosition(e.clientX, e.clientY)
        //   const _wayDot = {
        //     x: _dp.x,
        //     y: _dp.y
        //   };
        //   if (this.detectTwoPointClose(this.tmpPolygon, _wayDot)) {
        //     this.tmpPolygon['closed'] = true;
        //     this.drawsHistory.push(this.tmpPolygon)
        //     this.tmpPolygon = null;
        //   } else {
        //     this.tmpPolygon['way'] = this.tmpPolygon.way ? this.tmpPolygon['way'] : []
        //     this.tmpPolygon['way'].push(_wayDot)
        //   }
        // }
        // break;
    }
    
  }
  // 矩形最终调整数据修正
  finalRectAdjustment(someOneRect) {
    someOneRect['width'] = Math.abs(someOneRect.width)
    someOneRect['height'] = Math.abs(someOneRect.height)
    someOneRect['x'] = someOneRect.x > someOneRect.dx ? someOneRect.dx : someOneRect.x
    someOneRect['y'] = someOneRect.y > someOneRect.dy ? someOneRect.dy : someOneRect.y
    someOneRect['dx'] = someOneRect.x > someOneRect.dx ? someOneRect.x : someOneRect.dx
    someOneRect['dy'] = someOneRect.y > someOneRect.dy ? someOneRect.y : someOneRect.dy
    return someOneRect;
  }
  // 计算画笔是否在某个画图上
  calcIsOnDrawPath(x, y) {
    let _flag = null;
    for(let i=0;i<this.drawsHistory.length;i++) {
      const _item = this.drawsHistory[i];
      switch(_item.type) {
        case "rect":
          const _tmpRect = new Path2D()
          _tmpRect.rect(_item.x, _item.y, _item.width, _item.height)
          if(this.sbCtx.isPointInStroke(_tmpRect, x, y)){
            _flag = {
              data: _item,
              // data: this.drawsHistory.slice(i, i+1),
              index: i
            }
          }
          break;
      }
      if (_flag) {
        break;
      }
    }
    return _flag;
  }
  // 计算画笔是否在已选中的画图上
  calcIsInsideDraw(x, y) {
    let _final = false;
    if (this.selectedDraw) {
      const _item = this.selectedDraw.data;
      switch(_item.type) {
        case "rect":
          const _tmpRect = new Path2D()
          _tmpRect.rect(_item.x, _item.y, _item.width, _item.height)
          _final = this.sbCtx.isPointInPath(_tmpRect, x, y)
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
  // 绘画矩形
  drawRect(cx, cy) {
    const _ds = this.getDeltaSize(cx, cy)
    this.sbCtx.strokeRect(this.pencilPosition.x, this.pencilPosition.y, _ds.width, _ds.height);
    return {
      x: this.pencilPosition.x,
      y: this.pencilPosition.y,
      dx: cx,
      dy: cy,
      width: _ds.width,
      height: _ds.height,
      type: 'rect',
    }
  }
}