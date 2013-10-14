#谈Promise/A模式误区以及实践

## 什么是Promise
Promise是一种让异步代码书写起来更优雅的模式，更准确的说能够让异步代码像同步代码那样书写并且阅读，比如下面这个异步请求的例子：

```
$.get("/js/script,js", function () {
    // callback to do
})
```

就可以改写为Promise模式：

```
var promise = $.get("/js/script");
```

返回值promise即代表操作的最终结果。promise也可以最为“第一类对象”（First-class object），被当做参数传递, 被聚合(aggregating)在一起等等。而避免了传统异步代码中回调函数嵌套回调函数的糟糕情况。

谈到Promise，最先想到的是它的`then`关键字，的确，在Promise模式的定义中([CommonJS Promises/A](http://wiki.commonjs.org/wiki/Promises/A))中，`then`关键字的确非常重要：

>A promise is defined as an object that has a function as the value for the property then: `then(fulfilledHandler, errorHandler, progressHandler)`

上面的例子同样可以改写为：

```
var fulfilledHandler = function () {}
var errorHandler = function () {}
var progressHandler = function () {}

$.get("/js/script").then(fulfilledHandler, errorHandler, progressHandler)
```
但promise的重点并非在上面各种回调函数的聚合，**而是在于提供了一种同步函数与异步函数联系和通信的方式**

## Promise的误区

让我们回过头来看看同步函数最重要的两个特征

- 能够返回值
- 能够抛出异常

这和高等数学中的[复合函数](http://zh.wikipedia.org/wiki/%E5%A4%8D%E5%90%88%E5%87%BD%E6%95%B0)(function composition)很像，也就是说你可以将一个函数的返回值直接传递给另一个函数，并且将另一个函数的返回值再传递给其他函数……像一条“链”一样无限的这么做下去。更重要的是，如果当中的某一环节出现了异常，这个异常能够被抛出，传递出去直到被`catch`捕获。

而在传统的异步操作中不再会有返回值，也不再会抛出异常——或者你可以抛出，但是没有人可以捕获。这样的结果导致必须在异步操作的回调中再嵌套一系列的回调，为了获取返回值也好，为了捕获异常也好。

而Promise模式恰好就是为这两个缺憾准备的，模式规定你的函数必须返回一个“promise”，它可以做两件事：

- 根据某个值完成操作(fulfilled)
- 抛出异常(rejected)

一个被fulfilled执行的结果(fulfillment)，是可以作为另一个函数参数，而由rejected抛出的异常也是可以被函数的捕获的，比如看下面这个Promise的例子：

```
$.get("/user/784533")
.then(function (info) {
    var userInfo = parseData(JSON.parse(info));
    return resolve(userInfo);
})
.then(getCreditInfo)
.then(function (result) {
    console.log("User credit info: ", result);
}, function (error) {
    console.error("Error:", error);
})

```

```
try {
    var info = $.get("/user/784533"); //Blocking
    var userInfo = parseData(JSON.parse(info));
    
    var resolveResult = parseData(userInfo);
    var creditInfo = getCreditInfo(resolveResult); //Blocking

    console.log("User credit info: ", result);
} cacth(e) {
    console.error("Error:", error);
}
```