'use strict';
ionicApp
.factory('walletManage', ['$ionicModal','Wallet','Me', 'globalFuncs','Wechat','Coinprice','Coinorders','Ether','web3Provider','Coinorders','Coinordergetpayparams','$ionicLoading','$timeout',
function($ionicModal,Wallet,Me,globalFuncs,Wechat,Coinprice,Coinorders,Ether,web3Provider,Coinorders,Coinordergetpayparams,$ionicLoading,$timeout){
    return function(scope, callback){
        vcallback = callback || angular.noop;
        $ionicModal.fromTemplateUrl('templates/walletManage.html',{
            'scope': scope,
            'backdropClickToClose': false
        }).then(function(modal){
            var customCallback = angular.noop;
            modal.showModal = function(c){
                if(c)customCallback = c;
                scope.me = {};
                Me.get().$promise.then(function(res){
                    if(!Wechat.hasAccessToken())Wechat.getAccessToken();
                    scope.me = res;
                    modal.show();
                },function(err){
                    Wechat.loginWechat(function(){
                        console.log($scope.$root.language.tipMsg4)
                    },function(msg){
                        console.log(msg)
                    });
                })
            }

            modal.hideModal = function(){
                modal.hide();
            }

            scope.$on('$destroy', function(){
                modal.remove();
            });

            scope.close = function(){
                modal.hideModal();
            };

            callback(modal);

            scope.password = "";
            scope.wallet = null;
            scope.isDone = true;
            scope.showWallet = false;
            scope.showWalletInfo = false;
            scope.blob = scope.blobEnc = "";
            scope.creatWallet = function(password){
                if(!password||password.length<9){
                    alert($scope.$root.language.tipMsg9)
                }else if(scope.isDone){
                    scope.isDone = false;
                    scope.wallet = Wallet.generate(false);
                    scope.showWallet = true;
                    scope.privateKeyEnc = scope.wallet.toV3(password, {
                        kdf: globalFuncs.kdf,
                        n: globalFuncs.scrypt.n
                    });
                    scope.encFileName =  scope.wallet.getV3Filename();
                    scope.isDone =  true;
                }
            }

            scope.refresh = function(){
                scope.page = 1;
                scope.getOrder();
                window.mdc.balances(scope.walletObj.getAddressString()).then(function(res){
                    scope.balance = res.toNumber()+"";
                })
                Ether.getBalance({'balance':scope.walletObj.getAddressString(),'isClassic':true}).$promise.then(function(res){
                    scope.wallet = res.data;
                },function(msg){
                    alert(JSON.stringify(msg));
                })
                Coinprice.get().$promise.then(function(res){
                    scope.advicedPrice = res.ethcny;
                },function(msg){
                    // alert($scope.$root.language.errMsg7)
                });
            }

            scope.page = 1;
            scope.getOrder = function(){
                $ionicLoading.show();
                Coinorders.get({'page':scope.page}).$promise.then(function(res){
                    console.log(res)
                    scope.orders = res;
                    $ionicLoading.hide();
                },function(msg){
                    alert(JSON.stringify(msg))
                    $ionicLoading.hide();
                });
            }

            scope.preOrder = function(){
                if(scope.page>1)scope.page = scope.page-1;
                scope.getOrder();
            }

            scope.nextOrder = function(){
                scope.page = scope.page+1;
                scope.getOrder();
            }

            scope.bindExistWallet = function(address,key,password){
                var wallet = new Wallet(key);
                var privateKeyEnc = wallet.toV3(password, {
                    kdf: globalFuncs.kdf,
                    n: globalFuncs.scrypt.n
                });
                scope.me.address = address;
                scope.me.encrypted_wallet_key = JSON.stringify(privateKeyEnc);
                $ionicLoading.show();
                Me.update(scope.me).$promise.then(function(res){
                    scope.me = res;
                    $ionicLoading.hide();
                },function(msg){
                    alert(JSON.stringify(msg))
                    $ionicLoading.hide();
                })
            }

            scope.bindWallet = function(){
                scope.me.address = scope.wallet.getChecksumAddressString();
                scope.me.encrypted_wallet_key = JSON.stringify(scope.privateKeyEnc);
                $ionicLoading.show();
                Me.update(scope.me).$promise.then(function(res){
                    scope.me = res;
                    $ionicLoading.hide();
                },function(msg){
                    alert(JSON.stringify(msg))
                    $ionicLoading.hide();
                })
            }

            scope.decryptWallet = function(password) {
                $ionicLoading.show();
                Coinprice.get().$promise.then(function(res){
                    scope.advicedPrice = res.ethcny;
                },function(msg){
                    $ionicLoading.hide();
                    // alert($scope.$root.language.errMsg7)
                });
                scope.addWalletStats = "";
                try {
                    scope.walletObj = Wallet.getWalletFromPrivKeyFile(scope.me.encrypted_wallet_key, password);
                } catch (e) {
                    $ionicLoading.hide();
                    alert(e)
                    return;
                }
                web3Provider.init(scope.walletObj.getAddressString(),scope.walletObj.getPrivateKeyString());
                $ionicLoading.hide();
                customCallback();
                modal.hideModal();
                // window.mdc.balances(scope.walletObj.getAddressString()).then(function(res){
                //     scope.balance = res.toNumber()+"";
                // })
                // Ether.getBalance({'balance':scope.walletObj.getAddressString(),'isClassic':true}).$promise.then(function(res){
                //     scope.wallet = res.data;
                //     scope.showWalletInfo = true;
                //     $ionicLoading.hide();
                // },function(msg){
                //     alert(JSON.stringify(msg));
                //     $ionicLoading.hide();
                // })
                // scope.getOrder();
            };

            scope.recharge = function(joinPrice){
                $ionicLoading.show();
                Me.get().$promise.then(function(me){
                    Coinorders.add({},{'coin':joinPrice}).$promise.then(function(data){
                        Coinordergetpayparams.add({'access_token':WXOauth.oauthData.access_token,'openid':WXOauth.oauthData.openid,'out_trade_no':data.out_trade_no},{}).$promise.then(function(wechatParams){
                            $ionicLoading.hide();
                            var params = {
                                'appId':wechatParams.appId,
                                'nonceStr':wechatParams.nonceStr,
                                'package':wechatParams.package,
                                'paySign':wechatParams.paySign,
                                'signType':wechatParams.signType,
                                'timeStamp':wechatParams.timeStamp
                            }
                            var onBridgeReady = function(){
                               console.log("onBridgeReady")
                               WeixinJSBridge.invoke(
                                   'getBrandWCPayRequest', params, function(res){
                                       console.log("onBridgeReadyResult")
                                       if(res.err_msg == "get_brand_wcpay_request:ok" ) {
                                           alert($scope.$root.language.tipMsg6);
                                           scope.getOrder()
                                       }else{
                                           alert($scope.$root.language.errMsg11);
                                       }
                                   }
                               );
                            }
                            if (typeof WeixinJSBridge == "undefined"){
                               if( document.addEventListener ){
                                   document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
                               }else if (document.attachEvent){
                                   document.attachEvent('WeixinJSBridgeReady', onBridgeReady);
                                   document.attachEvent('onWeixinJSBridgeReady', onBridgeReady);
                               }
                            }else{
                               onBridgeReady();
                            }
                        },function(msg){
                            alert(JSON.stringify(msg))
                            $ionicLoading.hide();
                        })
                    },function(msg){
                        alert(JSON.stringify(msg))
                        $ionicLoading.hide();
                    });
                },function(err){
                    $ionicLoading.hide();
                    Wechat.loginWechat(function(){
                        console.log($scope.$root.language.tipMsg4)
                    },function(msg){
                        console.log(msg)
                    });
                })
            }
        });
    };
}])
