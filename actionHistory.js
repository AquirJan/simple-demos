class recordActionHistory {
  constructor(options) {
    this.options = Object.assign({
      recordName: '', // 是否使用特定名字
      useWindow: true, // 是否使用window对象存储历史操作
      historyArray: [], // 操作记录的历史数据
    }, options);
    this.revokedStep = 0
    this.showoffHistoryArray = []
    this.historyActionArray = []
    this.init()
  }

  revoke() {
    this.revokedStep = this.revokedStep + 1;
    if (this.revokedStep > this.historyActionArray.length) {
      this.revokedStep = this.historyActionArray.length;
      return this.showoffHistoryArray
    }
    this.showoffHistoryArray.shift()
    return this.showoffHistoryArray
  }

  onward() {
    this.revokedStep = this.revokedStep - 1;
    if (!this.historyActionArray[this.revokedStep]) {
      this.revokedStep = this.revokedStep + 1;
      return this.showoffHistoryArray
    }
    this.showoffHistoryArray.unshift(this.historyActionArray[this.revokedStep])
    return this.showoffHistoryArray
  }

  getHistoryArray() {
    return this.showoffHistoryArray
  }

  getRevokedStep() {
    return this.revokedStep
  }

  recordChange(data) {
    this.historyActionArray.splice(this.revokedStep, 0, data)
    if (this.revokedStep!==0) {
      this.historyActionArray = this.historyActionArray.slice(-(this.historyActionArray.length-this.revokedStep))
      this.revokedStep = 0;
    }
    this.showoffHistoryArray = this.historyActionArray.slice()
  }

  init() {
    this.historyActionArray = [...this.options.historyArray]
    if (this.options.useWindow) {
      if (window[this.options.recordName]) {
        console.warn('改变量名已被使用')
        return null;
      } else {
        return window[this.options.recordName]
      }
    }

    return this
  }

}