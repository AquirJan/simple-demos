import cloneDeep from './lodash.clonedeep.js';
export default class recordActionHistory {
  constructor(options) {
    this.options = Object.assign({
      recordName: '', // 是否使用特定名字
      historyArray: [], // 操作记录的历史数据
    }, cloneDeep(options));
    this.revokedStep = 0
    this.showoffHistoryArray = []
    this.historyActionArray = []
    this.init()
  }
  // 后退
  revoke() {
    this.revokedStep = this.revokedStep + 1;
    if (this.revokedStep >= this.historyActionArray.length) {
      this.revokedStep = this.historyActionArray.length - 1
      return null;
    }
    this.showoffHistoryArray.shift()
    return this.showoffHistoryArray
  }
  // 前进
  onward() {
    this.revokedStep = this.revokedStep - 1;
    if (this.revokedStep < 0) {
      this.revokedStep = 0
      return null;
    }
    if (!this.historyActionArray[this.revokedStep]) {
      this.revokedStep = this.revokedStep + 1;
      return this.showoffHistoryArray
    }
    this.showoffHistoryArray.unshift(this.historyActionArray[this.revokedStep])
    return this.showoffHistoryArray
  }
  // 获取显示的历史操作数组
  getHistoryArray() {
    return cloneDeep(this.showoffHistoryArray)
  }
  // 获取显示的历史操作数组长度
  getHistoryArrayLength() {
    return this.showoffHistoryArray.length
  }
  // 获取最新一个
  getHistoryArrayFirst() {
    return this.showoffHistoryArray && this.showoffHistoryArray.length ? cloneDeep(this.showoffHistoryArray[0]) : null;
  }
  // 获取当前步数
  getRevokedStep() {
    return this.revokedStep
  }
  // 记录历史变化
  recordChange(data) {
    this.historyActionArray.splice(this.revokedStep, 0, cloneDeep(data))
    if (this.revokedStep !== 0) {
      this.historyActionArray = this.historyActionArray.slice(-(this.historyActionArray.length - this.revokedStep))
      this.revokedStep = 0;
    }
    this.showoffHistoryArray = cloneDeep(this.historyActionArray)
  }
  // 初始化
  init() {
    this.historyActionArray = this.options.historyArray

    return this
  }
  destroy() {
    this.options = null;
    this.revokedStep = null;
    this.showoffHistoryArray = null;
    this.historyActionArray = null;
  }
}