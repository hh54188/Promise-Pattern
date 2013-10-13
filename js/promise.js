var Promise = (function () {
    var callbacks = [];
    var statusStack = [];

    function Promise() {
        this.isPromise = true;
    }

    Promise.prototype = {
        resolve: function (result) {
            this.complete("resolve", result);

        },

        reject: function (result) {
            var _this = this;
            setTimeout(function () {
                _this.complete("reject", result);    
            });
        },

        executeInLoop: function (promise,result) {

            if ((promise && !promise.isPromise || !promise) && callbacks.length) {

                var callback = this.getCallbackByType("resolve");

                if (callback) {
                    var promise = callback(promise? promise: result);
                    this.executeInLoop(promise, promise? promise: result);
                }
            }
        },

        getCallbackByType: function (type) {
            if (callbacks.length) {

                var callback = callbacks.shift()[type];

                while (!callback) {
                    callback = callbacks.shift()[type];
                }                    

            }

            return callback;
        },

        complete: function (type, result) {

            var callback = this.getCallbackByType(type);

            if (callback) {
                var promise = callback(result);    
                this.executeInLoop(promise, promise? promise: result);
            }
        },

        then: function (successHandler, failedHandler) {
            callbacks.push({
                resolve: successHandler,
                reject: failedHandler
            });

            return this;
        }
    }

    return Promise;
})()