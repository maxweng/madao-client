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
        init: function(userAddress,userkey,noSigner){
            // userAddress = '0xb57be5149842f218a95da90599ba2b7a70f888e7';
            // userkey = 'a8d9edff20ef6fd7000f43ec103904bdc173ea55e1008413dcb744d4bf016590';

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
                var provider
                if(noSigner){
                    provider = new window.MBSProvider(APP_CONFIG.host+"/api",userkey)
                }else{
                    provider = new window.MBSProvider(APP_CONFIG.host+"/api",userkey,transaction_signer)
                }

                window.web3 = new Web3(provider);
                web3.eth.defaultAccount = userAddress;

            window.MDC.setNetwork("3");
            window.MDC.setProvider(window.web3.currentProvider);
            window.mdc = window.MDC.deployed();
        }
    }
}])
;
