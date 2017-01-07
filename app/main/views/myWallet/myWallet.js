'use strict';
ionicApp
.controller('myWalletCtrl', ['$scope', '$state','Wallet','Me','globalFuncs',
'Wechat','$http','Coinprice','Coinorders','Ether','web3Provider','ethUnits',
'Coinorders','Coinordergetpayparams','$timeout','$ionicLoading','walletManage',
function ($scope,$state, Wallet,Me,globalFuncs,Wechat,$http,Coinprice,Coinorders,
    Ether,web3Provider,ethUnits,Coinorders,Coinordergetpayparams,$timeout,$ionicLoading,walletManage) {
    $scope.$on('$ionicView.beforeEnter', function(){
        walletManage($scope, function(modal){
            $scope.modal = modal;
            Me.get().$promise.then(function(me){
                $scope.me = me;
                if(!$scope.me.encrypted_wallet_key){
                    $scope.modal.showModal(function(){
                        $scope.getData();
                    });
                }
                if(window.mdc&&$scope.$root.address&&$scope.$root.privateKey){
                    $scope.getData();
                }else{
                    web3Provider.init($scope.me.address,'');
                    $scope.getData();
                }
            },function(err){
                $scope.modal.showModal();
            })
        });
    });

    $scope.password = "";
	$scope.wallet = null;
    $scope.showWalletInfo = false;

    $scope.getData = function(){
        $scope.page = 1;
        $scope.getOrder();
        window.mdc.balances($scope.me.address).then(function(res){
            $scope.balance = res.toNumber()+"";
        })
        Ether.getBalance({'balance':$scope.me.address,'isClassic':true}).$promise.then(function(res){
            $scope.wallet = res.data;
        },function(msg){
            alert(JSON.stringify(msg));
        })
        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
        },function(msg){
            // alert($scope.$root.language.errMsg7)
        });
    }

    $scope.page = 1;
    $scope.getOrder = function(){
        $ionicLoading.show();
        Coinorders.get({'page':$scope.page}).$promise.then(function(res){
            console.log(res)
            $scope.orders = res;
            $ionicLoading.hide();
        },function(msg){
            alert(JSON.stringify(msg))
            $ionicLoading.hide();
        });
    }

    $scope.preOrder = function(){
        if($scope.page>1)$scope.page = $scope.page-1;
        $scope.getOrder();
    }

    $scope.nextOrder = function(){
        $scope.page = $scope.page+1;
        $scope.getOrder();
    }

    $scope.recharge = function(joinPrice){
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
                                   $scope.getOrder()
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
}])
;
