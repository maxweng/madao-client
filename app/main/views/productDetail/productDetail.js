ionicApp.controller('productDetailCtrl', ['$scope','$state','Coinprice','tools','Me','Ether','web3Provider','ethFuncs',
'ethUnits','Coinorders','Coinordergetpayparams','Wechat','$ionicLoading','Wallet','walletManage','APP_CONFIG','$ionicPopup',
function($scope,$state,Coinprice,tools,Me,Ether,web3Provider,ethFuncs,ethUnits,
    Coinorders,Coinordergetpayparams,Wechat,$ionicLoading,Wallet,walletManage,APP_CONFIG,$ionicPopup){
    $scope.$on('$ionicView.beforeEnter', function(){
        if(!Wechat.hasAccessToken()){
            Wechat.getAccessToken();
        }else{
            walletManage($scope, function(modal){
                $scope.modal = modal;
                Me.get().$promise.then(function(me){
                    $scope.me = me;
                    if(!$scope.me.encrypted_wallet_key){
                        $scope.modal.showModal();
                    }else{
                        var hasSetWallet = true;
                        if(window.mdc&&$scope.$root.address&&$scope.$root.privateKey){

                        }else{
                            var wallet;
                            $ionicPopup.prompt({
                                title: $scope.$root.language.tip10,
                                inputType: 'password',
                                okText: $scope.$root.language.ok,
                                cancelText: $scope.$root.language.cancel
                            }).then(function(str){
                                if(str){
                                    try {
                                        wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, str);
                                    } catch (e) {
                                        $scope.modal.showModal();
                                        hasSetWallet = false;
                                        return;
                                    }
                                    web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
                                }else{
                                    $scope.modal.showModal();
                                    hasSetWallet = false;
                                }
                            })
                            
                        }
                    }
                    if(hasSetWallet){
                        Coinprice.get().$promise.then(function(res){
                            $scope.advicedPrice = res.ethcny;
                            joinPrice = 1;
                        },function(msg){
                            // alert($scope.$root.language.errMsg7)
                        });
                    }   
                },function(err){
                    $scope.modal.showModal();
                })
            });
        }
    });

    $scope.provision = function(){
        if(APP_CONFIG.language == 'en'){
            $state.go('app.provisionEn');
        }else{
            $state.go('app.provision');
        }
    }

    var joinPrice = -1;
    $scope.data = {};

    var bayCoin = function(joinPrice){
        if(!Wechat.hasAccessToken()){
            Wechat.getAccessToken();
            return;
        }
        Me.get().$promise.then(function(me){
            Coinorders.add({},{'coin':(buyPrice+0.2)}).$promise.then(function(data){
                console.log(data)
                Coinordergetpayparams.add({'access_token':WXOauth.oauthData.access_token,'openid':WXOauth.oauthData.openid,'out_trade_no':data.out_trade_no},{}).$promise.then(function(wechatParams){
                    console.log(wechatParams)
                    var params = {
                        'appId':wechatParams.appId,
                        'nonceStr':wechatParams.nonceStr,
                        'package':wechatParams.package,
                        'paySign':wechatParams.paySign,
                        'signType':wechatParams.signType,
                        'timeStamp':wechatParams.timeStamp
                    }
                    console.log(params)
                    var onBridgeReady = function(){
                       console.log("onBridgeReady")
                       WeixinJSBridge.invoke(
                           'getBrandWCPayRequest', params, function(res){
                               console.log("onBridgeReadyResult")
                               if(res.err_msg == "get_brand_wcpay_request:ok" ) {
                                   alert($scope.$root.language.tipMsg6);
                                   $scope.join();
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
                })
            },function(msg){
                alert(JSON.stringify(msg))
            });
        },function(err){
            Wechat.loginWechat(function(){
                console.log($scope.$root.language.tipMsg4)
            },function(msg){
                console.log(msg)
            });
        })
    }

    $scope.join = function(){
        if(joinPrice<0){
            alert($scope.$root.language.errMsg7);
            return;
        }
        if(!$scope.data.name){
            alert($scope.$root.language.errMsg12);
            return;
        }
        if(!$scope.data.country){
            alert($scope.$root.language.errMsg13);
            return;
        }
        if(!$scope.data.id){
            alert($scope.$root.language.errMsg14);
            return;
        }
        $ionicLoading.show();
        var id = tools.hexEncode($scope.data.id);
        $scope.data.noncestr = tools.noncestr($scope.$root.address);
        window.mdc.signUp($scope.data.recommender || "", $scope.data.name, $scope.data.country, id, $scope.data.noncestr, { from: $scope.$root.address, value: ethUnits.toWei(joinPrice,"ether"),'gasLimit':1000000,'gasPrice':20000000000}).then(function (transactionId) {
            console.log('Sign up transaction ID: ', '' + transactionId);
            Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                $ionicLoading.hide();
                if(!res.data.transactionIndex&&res.data.transactionIndex!=0){
                    alert($scope.$root.language.tipMsg1)
                    $state.go('app.tabs.product');
                }else{
                    alert($scope.$root.language.tipMsg8)
                    $state.go('app.tabs.product');
                }
            },function(err){
                $ionicLoading.hide();
                alert(err.message);
            });
        }).catch(function(error){
            $ionicLoading.hide();
            if(error&&(error.message.indexOf("sender doesn't have enough funds to send tx")!=-1||
        error.message.indexOf("Account does not exist or account balance too low")!=-1)){
                alert($scope.$root.language.errMsg16);
                bayCoin(joinPrice);
            }else if(error.message.indexOf("Insufficient funds for gas * price + value")!=-1){
                alert($scope.$root.language.errMsg17);
                bayCoin(joinPrice);
            }else{
                console.log(error)
                alert($scope.$root.language.errMsg15);
            }
        });

        Me.get().$promise.then(function(res){
            res.real_name = $scope.data.name;
            res.country = $scope.data.country;
            res.id_no = $scope.data.id;
            Me.update(res).$promise.then(function(res){
                $scope.me = res;
            },function(msg){
                alert(JSON.stringify(msg))
            })
        },function(err){

        })
    }
}])
;
