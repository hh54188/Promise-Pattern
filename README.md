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

- 根据某个值完成某项操作(fulfilled)
- 抛出异常(rejected)

一个被fulfilled执行过后的结果(fulfillment)，是可以作为另一个函数参数，而由rejected抛出的异常也是可以被函数的捕获的，比如看下面这个Promise的例子：

```
$.get("/user/784533") // promise return
.then(function (info) {
    var userInfo = parseData(JSON.parse(info));
    return resolve(userInfo); // promise return
})
.then(getCreditInfo) // promise return
.then(function successHandler(result) {
    console.log("User credit info: ", result);
}, function errorHandler(error) {
    console.error("Error:", error);
})

```
上面的例子中`$.get().then()`返回的结果直接传入了`getCreditInfo`函数中，而getCreditInfo执行的结果又可以作为`result`传入`successHandler`中。即使上面任何一个过程发生了异常，也都能够被最后一个errorHandler捕获。


我们可以把它改写为同步函数的形式：注释中Blocking语句即为原异步操作，这样以来函数复合便一目了然了
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


但是在某些类库，甚至在jQuery之前的版本中，往往忽略了对异常的捕获，就拿jQuery1.5.0来说（jQuery在1.5.0版本中引入Promise，在1.8.0开始得到修正）：

```
/*  
    无法捕获异常        
*/
var step1 = function() {
    console.log("------step1------");
    var d = $.Deferred();
    d.resolve('Some data');
    return d.promise();
},

step2 = function(str) {
    console.log("------step2------");
    console.log("step2 recevied: ", str);

    var d = $.Deferred();
    // 故意在fulfilled hanlder中抛出异常
    d.reject(new Error("This is failing!!!"));
    return d.promise();
},

step3 = function(str) {
    console.log("------step3------");
    console.log("step3 recevied: ", str);

    var d = $.Deferred();
    d.resolve(str + ' to display');
    return d.promise();
},

completeIt = function(str) {
    console.log("------complete------");
    console.log("[complete]------>", str);
},

handleErr = function(err) {
    console.log("------error------");
    console.log("[error]------>", err);
};   

step1().
then(step2).
then(step3).
then(completeIt, handleErr);    
```
上述代码在[jQuery-1.5.0](http://ajax.googleapis.com/ajax/libs/jquery/1.5.0/jquery.min.js)中运行的结果：

```
------step1------
------step2------
step2 recevied:  Some data
------step3------
step3 recevied:  Some data
------complete------
[complete]------> Some data
```

在step2中，在解析step1中传递的值后故意抛出了一个异常，但是我们在最后定义的errorHandler却没有捕获到这个错误。

忽略捕获异常的错误，上面的结果还反映出另一个问题，最后一步completeHandler中处理的值应该是由step3中决定的，也就是step3中的` d.resolve(str + ' to display');`，最后应打印出的结果为`some data to display`。

在[jQuery-1.9.0](http://ajax.googleapis.com/ajax/libs/jquery/1.5.0/jquery.min.js)中是可以捕获的，运行结果为：

```
------step1------
------step2------
step2 recevied:  Some data
------error------
[error]------> Error {}  
```

注意到step3没有执行，因为step3中只有应对fulfilled的情况，所以也就什么都不做了，只有在最后error才被捕获。

其实我们可以试试，在step3中添加处理异常的handler：

```
step1().
then(step2).
then(step3, function (str) {
    console.log("------[error] step3------");
    console.log("step3 revecied: ", str);

    var d = $.Deferred();
    d.resolve(str + ' to display');
    return d.promise();    
}).
then(completeIt, handleErr);
```
运行结果如下:

```
------step1------
------step2------
step2 recevied:  Some data
------[error] step3------ 
step3 revecied:  Error {} 
------complete------ 
[complete]------> Error: This is failing!!! to display 
```

虽然错误在step3被捕获了，但是由于我们将错误信息传递了下去，最后一步打印出的仍然是错误消息



让我们继续看看Promise/A定义的第二段：

> This function should return a new promise that is fulfilled when the given fulfilledHandler or errorHandler callback is finished. This allows promise operations to be chained together. The value returned from the callback handler is the fulfillment value for the returned promise. If the callback throws an error, the returned promise will be moved to failed state.

这段定义告诉我们两点：

1. 无论返回值是fulfilled也好，还是被rejected也好，必须返回一个新的promise；
2. `then`关键字并非只是各个回调的填充器，在输入的同时它同时也输出新的promise，以便形成链式;

同样以jQuery的代码为例：

```
var step1 = function() {
    console.log("------step1------");
    var d = $.Deferred();
    d.resolve('Some data');
    return d.promise();
};

var step2 = function (result) {
    console.log("------step2------");
    console.log("step2 recevied: " + result);
    var d = $.Deferred();
    d.resolve("step2 resolve: " + result);
    return d.promise();
}

var step3 = function (result) {
    console.log("------step3------");
    console.log("step3 recevied: " + result);
    var d = $.Deferred();
    d.reject(new Error("This is failing!!!"));
    return d.promise();
}

var promise = step1();

var promise1 = promise.then(step2);
var promise2 = promise.then(step3);
```
step1返回的promise是要会被正确fulfilled的，但不同的是step2 fulfilled之后，返回一个仍然可被解析的promise，而step3则抛出一个异常。

上面这段代码为了验证promise的第二段定义，即无论是被正确解析还是抛出异常，返回的都应该是一个独立的promise。

为了验证产生的是否为独立的promise，只需看他们的执行结果如何，接着给promise1和promise2定义处理函数：

```
promise1.then(function (result) {
    console.log("Success promise1: ", result);
}, function () {
    console.log("Failed promise1: ", result);
})

promise2.then(function (result) {
    console.log("Success promise2: ", result);
}, function (result) {
    console.log("Failed promise2: ", result);
}) 
```

让我们看看在jQuery-1.5.0中执行的结果：

```
Success promise1:  Some data
Success promise2:  Some data 
```

在jQuery-1.9.0中：

```
Success promise1:  step2 resolve: Some
Failed promise2:  Error {}
```

## 实践

接下来我们简单用代码实现一个Promise模式。

参照jQuery的`Deferred`模式，我们可以了解Promise的大致结构：

```
var Promise = function () {}

Promise.prototype.when = function () {
    // to do
}

Promise.prototype.resolve = function () {
    // to do
}

Promise.prototype.rejected = function () {
    // to do
}
```
并且我们用最简单一个异步操作`setTimeout`来验证我们的Promise是否奏效：

```
var delay = function (throwError) {
    var promise = new Promise();

    if (throwError) {
        promise.reject(new Error("ERROR"));
        return promise;
    }

    setTimeout(function () {
        promise.resolve("some data");
    }, 1000);

    return promise;
}

delay().then(function (result) {
    console.log(result);
}).then(function () {
    console.log("This is the second successHandler");    
}).then(function () {
    console.log("This is the third successHandler");
})
```

首先我们要为每一个Promise准备一个**队列**来存储自己的handler

```
function Promise() {
    this.callbacks = [];
}
```

我们可以暂且把`then()`理解为往队列中填入handler的函数，并且为了能以链式的形式添加处理函数，最后必须返回当前promise：

```
Promise.prototype.then = function (successHandler, failedHandler) {
    this.callbacks.push({
        resolve: successHandler,
        reject: failedHandler
    });

    return this;
}
```
其实resolve和reject虽然名称不同，但是都是执行各自对应的回调函数，我们可以抽象出一个公共的complete方法：

```
Promise.prototype = {
    resolve: function (result) {
        this.complete("resolve", result);
    },

    reject: function (result) {
        this.complete("reject", result);
    },

    complete: function (type, result) {
        // to do
    }
}
```

`complete`的工作非常显而易见，根据type不同执行回调函数出队，以`result`为参数，执行相应`type`的的函数：

```
complete: function (type, result) {
    this.callbacks.shift()[type](result);
}
```

但是这样只能执行队首回调函数，在链式的情况下，可能在callbacks中添加了多个回调函数，为了实现链式的执行，需要把callbacks中的回调全部出队，complete可以改进为：

```
complete: function (type, result) {
    while(this.callbacks.length) {
        this.callbacks.shift()[type](result);
    }
}
```
完整版如下：

```
function Promise() {
    this.callbacks = [];
}

Promise.prototype = {
    resolve: function (result) {
        this.complete("resolve", result);
    },

    reject: function (result) {
        this.complete("reject", result);
    },

    complete: function (type, result) {
        while(this.callbacks[0]) {
            this.callbacks.shift()[type](result);
        }
    },

    then: function (successHandler, failedHandler) {
        this.callbacks.push({
            resolve: successHandler,
            reject: failedHandler
        });

        return this;
    }
}
```
第一个版本即完成，可以看到测试上面开始例子的结果，能够顺利打印出信息。

接下来我们完成处理异常部分

首先我们写一个能够故意抛出异常的测试用例

```
delay(true).then(function (result) {
    console.log(result);
}, function firstErrorHandler(error) {
    console.error("First failedHandler catch: ", error);

    var promise = new Promise();
    promise.resolve("some data");
    return promise;

}).then(function secondSucHandler(result) {
    console.log("Second successHandler recevied: ", result);
}, function (error) {
    console.error("Second failedHandler catch: ", error);
})
```

我们在delay中抛出异常，在`firstErrorHandler`捕获异常后，返回一个能被fulfilled的promise，并且用secondSucHandler顺利解析、

如果直接用上面版本执行，会发现没有任何结果，为什么？

**因为在执行`delay()`时，第一个`reject`也同时被执行，但此时`then`函数还没执行，也就是处理reject的handler还没有被定义。**当然也就不会有任何结果了。反过来也能想通，也就能说通resolve能被执行。

那么我们只要在reject函数中加上一定的延时即可：

```
...
reject: function (result) {
    var _this = this;
    setTimeout(function () {
        _this.complete("reject", result);    
    });
},
...
```

执行测试代码结果如下：

```
First failedHandler catch:  Error
Second failedHandler catch:  Error

```

虽然错误被捕获了，但错误被一直传递一下去了，这也就是我们之前说的jQuery无法返回新呃promise，接下来要解决这个问题。

我们来写一个更复杂的测试用例，来验证下面的解决方案：

```
delay()
// ------Level 1------
.then(function FirstSucHandler(result) {
    console.log("First successHandler recevied: ", result);

    var p = new Promise();
    p.reject(new Error("This is a test"));
    return p;                    

}, function FirstErrorHandler(error) {
    console.error("Second failedHandler catch: ", error);
})
// ------Level 2------
.then(function SecondSucHandler(result) {
    console.log("Second successHandler recevied: ", result);            
})
// ------Level 3------
.then(function ThirdSucHandler(result) {
    console.log("Third successHandler recevied: ", result);
}, function ThirdErrorHandler(error) {
    console.error("Third failedHandler catch: ", error);
})
// ------Level 4------
.then(function FourSucHandler(result) {
    console.log("Fourth successHandler recevied: ", result);
})
```

正确的执行顺序应该是`FirstSucHandler`fulfilled之后抛出异常，略过SecondSucHandler，异常被ThirdErrorHandler捕获，并且返回一个新的promise，由FourSucHandler解析。

接下来我们要修复并且考虑这些问题
1. 当异常被捕获之后将阻止异常往下传递
2. 定义中描述在fulfilled之后必须返回一个新的promise，但如果没有返回新的promise，或者是返回其他的值，应该作何处理？

对于第二点，我们暂且处理规则是：

1. 如果没有返回值，那么下一个handler将继续解析上一promise
2. 如果返回值存在，但返回值不为promise，默认调用resolve handler，并且返回值作为handler参数传入

大致流程图如下所示

```
                                push
                                 |
                    [successHandler, errorHandler]
                    ...
            ------->[successHandler, errorHandler]
            |                    | 
            |                  shift
            |                    |
            |                 execute 
            |        succussHandler or errorHandler
            |                    |
            |                    |
            |          ----------------------
            |          |                    |
            |        return               return
            -------- promise              nothing
            |                               |
            <-------------------------------|

```
从上图中可以看出，只要promise存在，它必然执行resolve或者reject，必然导致一组handler出队。如果抛出异常，但这组handler中没有errorHandler，那么这组handler便作废，直到找到下一个能捕获异常的handler。直到队列中handler全部出队。看来我们有必要写一个“直到找到我们需要的函数”的函数：

```
...
getCallbackByType: function (type) {
    if (callbacks.length) {

        var callback = callbacks.shift()[type];

        while (!callback) {
            callback = callbacks.shift()[type];
        }                    

    }

    return callback;
}
...
```

从上图中可以看出所有的promise可以共用一个callbacks队列，并且考虑到需要判断返回值是否为promise类型，我们最好还需要一个标志位，做如下修改：

```
var callbacks = [];

function Promise() {
    this.isPromise = true;
}
...
```

根据以上描述，这类似于一个递归的过程

```
promise --> resolve/reject ---> promise ---> resolve/reject
```

我们抽象出一个递归函数：

```
...
executeInLoop: function (promise,result) {

    if ((promise && !promise.isPromise || !promise) && callbacks.length) {

        var callback = this.getCallbackByType("resolve");

        if (callback) {
            var promise = callback(promise? promise: result);
            this.executeInLoop(promise, promise? promise: result);
        }
    }
},
...
```




