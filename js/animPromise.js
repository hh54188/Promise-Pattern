var Promise = (function () {
    var callbacks = [];
    var beforeCallbacks = [];
    var afterCallbacks = [];
    var statusStack = [];

    function Promise() {
        this.isPromise = true;
    }

    Promise.prototype = {
        resolve: function (stack, result) {
            if (stack == "before") {
                stack = beforeCallbacks;
            } else {
                stack = afterCallbacks;
            }
            this.complete("resolve", result, stack);

        },

        reject: function (result) {
            var _this = this;
            setTimeout(function () {
                _this.complete("reject", result);
            });
        },

        executeInLoop: function (promise, result, stack) {

            if ((promise && !promise.isPromise || !promise) && stack.length) {

                var callback = this.getCallbackByType("resolve", stack);

                if (callback) {
                    var promise = callback(promise? promise: result);
                    this.executeInLoop(promise, promise? promise: result, stack);
                }
            }
        },

        getCallbackByType: function (type, stack) {
            if (stack.length) {

                var callback = stack.shift()[type];

                while (!callback) {
                    callback = stack.shift()[type];
                }                    

            }

            return callback;
        },

        complete: function (type, result, stack) {

            var callback = this.getCallbackByType(type, stack);

            if (callback) {
                var promise = callback(result);    
                this.executeInLoop(promise, promise? promise: result, stack);
            }
        },

        first: function (successHandler, failedHandler) {
            beforeCallbacks.push({
                resolve: successHandler,
                reject: failedHandler
            });

            return this;
        },

        then: function (successHandler, failedHandler) {
            afterCallbacks.push({
                resolve: successHandler,
                reject: failedHandler
            });

            return this;
        }
    }

    return Promise;
})()