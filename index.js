let target = {};
let handler = {
    set: function(obj, prop, value, receiver) {
        console.log(receiver)
        obj[prop] = receiver;
        return true;
    }
};
let proxy = new Proxy(target, handler);
target.a = 'b';
console.log(target)
