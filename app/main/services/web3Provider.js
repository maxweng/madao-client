'use strict';
ionicApp
.factory('web3Provider', ['$rootScope','APP_CONFIG',
function($rootScope,APP_CONFIG){
    var formatAddress = function(input){
        if (typeof(input) !== 'string') {
            return input;
        } else if (input.length < 2 || input.slice(0,2) !== '0x') {
            return '0x' + input;
        } else {
            return input;
        }
    }

    return {
        init: function(userAddress,userkey){
            userAddress = '0xd71263e6520e121576ce130d1e1adc09f3785803';
            userkey = '8946053544d59e0c1081ae95070009904f7f7d42d371900a3cab640393c3ef20';
            if (typeof window.web3 !== "undefined") {
                window.web3 = new Web3(window.web3.currentProvider);
            }else{
                // var provider = new window.HookedWeb3Provider({
                //     host: "http://devmadao.msan.cn/api",
                //     transaction_signer: {
                //         hasAddress: function(address, callback) {
                //             var addrToCheck = formatAddress(address);
                //             if (addrToCheck == userAddress) {
                //                 callback(null, true);
                //             }
                //             else {
                //                 callback('Address not found!', false);
                //             }
                //         },
                //         signTransaction: function(txParams, callback) {
                //             var privateKey = new window.BufferObject.Buffer(userkey, 'hex');
                //             var tx = new window.ethUtil.Tx(txParams);
                //             tx.sign(privateKey);
                //             var serializedTx = tx.serialize();
                //             callback(null, serializedTx.toString('hex'));
                //         }
                //     }
                // });
                $rootScope.address = userAddress;
                $rootScope.privateKey = userkey;
                var transaction_signer = {
                    hasAddress: function(address, callback) {
                        var addrToCheck = formatAddress(address);
                        if (addrToCheck == userAddress) {
                            callback(null, true);
                        }
                        else {
                            callback('Address not found!', false);
                        }
                    },
                    signTransaction: function(txParams, callback) {
                        var privateKey = new window.BufferObject.Buffer(userkey, 'hex');
                        var tx = new window.ethUtil.Tx(txParams);
                        tx.sign(privateKey);
                        var serializedTx = tx.serialize();
                        callback(null, serializedTx.toString('hex'));
                    }
                };
                var provider = new window.MBSProvider(APP_CONFIG.host+"/api",userkey,transaction_signer)
                window.web3 = new Web3(provider);
                web3.eth.defaultAccount = userAddress;
            }
            window.MDC.setNetwork(APP_CONFIG.host=="/api"?"default":"3");
            window.MDC.setProvider(window.web3.currentProvider);
            window.mdc = window.MDC.deployed();
        }
    }
}])
;
