(function() {
    var XMLHttpRequest;
    if (typeof window !== 'undefined' && window.XMLHttpRequest) {
        XMLHttpRequest = window.XMLHttpRequest;
    } else {
        XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
    }

    var host,privateKey,transaction_signer,global_nonces;

    var MBSProvider = function (url,key,transactionSigner) {
        host = url || 'http://localhost:8545';
        privateKey = key;
        transaction_signer = transactionSigner;
        global_nonces = {};
    };

    var isBigNumber = function (object) {
        return object instanceof BigNumber ||
            (object && object.constructor && object.constructor.name === 'BigNumber');
    };

    var isString = function (object) {
        return typeof object === 'string' ||
            (object && object.constructor && object.constructor.name === 'String');
    };

    var toBigNumber = function(number) {
        number = number || 0;
        if (isBigNumber(number))
            return number;

        if (isString(number) && (number.indexOf('0x') === 0 || number.indexOf('-0x') === 0)) {
            return new BigNumber(number.replace('0x',''), 16);
        }

        return new BigNumber(number.toString(10), 10);
    };

    var rewritePayloads = function(index, requests, session_nonces, finished) {
        if (index >= requests.length) {
            return finished();
        }
        var payload = requests[index];

        var next = function(err){
            if (err != null) {
                return finished(err);
            }
            return rewritePayloads(index + 1, requests, session_nonces, finished);
        };

        if (payload.method != "eth_sendTransaction") {
            return next();
        }

        var tx_params = payload.params[0];
        var sender = tx_params.from;

        transaction_signer.hasAddress(sender,function(err, has_address){
            if (err != null || has_address == false) {
                return next(err);
            }
            var getNonce = function(done) {
                var nonce = session_nonces[sender];
                if (nonce != null) {
                    done(null, nonce);
                } else {
                    sendAsyncRequest({
                        jsonrpc: '2.0',
                        method: 'eth_getTransactionCount',
                        params: [sender, "pending"],
                        id: (new Date()).getTime()
                    }, function(err, result) {
                        if (err != null) {
                            done(err);
                        } else {
                            var new_nonce = result.result.nonce;
                            done(null, toBigNumber(new_nonce).toNumber());
                        }
                    })
                }
            }

            getNonce(function(err,nonce){
                if (err != null) {
                  return finished(err);
                }
                var final_nonce = Math.max(nonce, global_nonces[sender] || 0);
                tx_params.nonce = Web3.prototype.toHex(final_nonce);
                session_nonces[sender] = final_nonce + 1;
                global_nonces[sender] = final_nonce + 1;
                transaction_signer.signTransaction(tx_params, function(err, raw_tx) {
                  if (err != null) {
                    return next(err);
                  }
                  payload.method = "eth_sendRawTransaction";
                  payload.params = [raw_tx];
                  return next();
                });
            })
        });
    }

    var prepareRequest = function (async) {
        var request = new XMLHttpRequest();
        request.open('POST', host, async);
        request.setRequestHeader('Content-Type','application/json; charset=UTF-8');
        return request;
    };

    var completionAssign= function(){
        if (typeof Object.assign != 'function') {
          (function () {
        	Object.assign = function (target) {
        	 'use strict';
        	 if (target === undefined || target === null) {
        	   throw new TypeError('Cannot convert undefined or null to object');
        	 }

        	 var output = Object(target);
        	 for (var index = 1; index < arguments.length; index++) {
        	   var source = arguments[index];
        	   if (source !== undefined && source !== null) {
        	     for (var nextKey in source) {
        	       if (source.hasOwnProperty(nextKey)) {
        	         output[nextKey] = source[nextKey];
        	       }
        	     }
        	   }
        	 }
        	 return output;
        	};
        })();
        }
    }

    var changeParams = function(method,payload){
        completionAssign();
        if(method == 'eth_call'){
            payload = {
                'isClassic':true,
                'ethCall':payload.params[0]
            }
        }
        if(method == 'eth_sendTransaction'){
            var eTx = new window.ethUtil.Tx(payload.params[0]);
            eTx.sign(new BufferObject.Buffer(privateKey, 'hex'));
            var signedTx = '0x' + eTx.serialize().toString('hex');
            payload = {
                'isClassic':true,
                'rawtx':signedTx
            }
        }
        if(method == 'eth_getTransactionReceipt'){
            payload = {
                'isClassic':true,
                'txId':payload.params[0]
            }

        }
        if(method == 'eth_getTransactionCount'){
            payload = {
                'isClassic':true,
                'txdata':payload.params[0]
            }
        }
        if(method == 'eth_sendRawTransaction'){
            payload = {
                'isClassic':true,
                'rawtx':payload.params[0]
            }
        }

        return payload;
    }

    var changeResult = function(method,result){
        result = {
            'id':1,
            'jsonrpc':"2.0",
            'result':result.data
        }
        return result;
    }

    var sendRequest = function (payload) {
        var request = prepareRequest(false);

        try {
            request.send(JSON.stringify(changeParams(payload.method,payload)));
        } catch(error) {
            throw error;
        }

        var result = request.responseText;

        try {
            result = JSON.parse(result);
        } catch(e) {
            throw e;
        }

        return changeResult(payload.method,result);
    };

    MBSProvider.prototype.send = function(payload, callback) {
        var requests = payload;
        if (!(requests instanceof Array)) {
            requests = [requests];
        }
        for (var request of requests) {
            if (request.method == "eth_sendTransaction") {
                throw new Error("HookedWeb3Provider does not support synchronous transactions. Please provide a callback.")
            }
        }
        var finishedWithRewrite = function() {
            return sendRequest(payload, callback);
        };
        return rewritePayloads(0, requests, {}, finishedWithRewrite);
    }

    var sendAsyncRequest = function (payload, callback) {
        var request = prepareRequest(true);
        request.onreadystatechange = function() {
            if (request.readyState === 4) {
                var result = request.responseText;
                var error = null;
                try {
                    result = JSON.parse(result);
                    if(result.error)error = {
                        'message':result.msg
                    }
                } catch(e) {
                    error = e;
                }
                callback(error, changeResult(payload.method,result));
            }
        };

        try {
            request.send(JSON.stringify(changeParams(payload.method,payload)));
        } catch(error) {
            callback(error);
        }
    };

    MBSProvider.prototype.sendAsync = function(payload, callback) {
        var finishedWithRewrite = function() {
            sendAsyncRequest(payload, callback);
        };
        var requests = payload;
        if (!(payload instanceof Array)) {
            requests = [payload];
        }
        rewritePayloads(0, requests, {}, finishedWithRewrite);
    }

    if (typeof module != "undefined" && typeof module.exports != "undefined") {
        module.exports = MBSProvider;
    } else {
        window.MBSProvider = MBSProvider;
    }
})();
