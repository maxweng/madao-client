'use strict';
ionicApp
.controller('meCtrl', ['$scope', '$state','Wallet','Me','globalFuncs',
'Wechat','$http','Coinprice','Coinorders','Ether','web3Provider','ethUnits',
'Coinorders','Coinordergetpayparams',
function ($scope,$state, Wallet,Me,globalFuncs,Wechat,$http,Coinprice,Coinorders,
    Ether,web3Provider,ethUnits,Coinorders,Coinordergetpayparams) {
    $scope.$on('$ionicView.beforeEnter', function(){
        $scope.me = {};
        Me.get().$promise.then(function(res){
            if(!Wechat.hasAccessToken())Wechat.getAccessToken();
            $scope.me = res;
            $scope.getOrder();
        },function(err){
            Wechat.loginWechat(function(){
                console.log('登录成功')
            },function(msg){
                console.log(msg)
            });
        })

        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
        },function(msg){
            alert(JSON.stringify(msg))
        });
    });

    $scope.password = "";
	$scope.wallet = null;
    $scope.isDone = true;
    $scope.showWallet = false;
    $scope.showWalletInfo = false;
    $scope.blob = $scope.blobEnc = "";
    $scope.creatWallet = function(password){
        if(!password||password.length<9){
            alert("请输入长度至少为9位的密码")
        }else if($scope.isDone){
            $scope.isDone = false;
			$scope.wallet = Wallet.generate(false);
			$scope.showWallet = true;
            //获得下载链接
			// $scope.blob = globalFuncs.getBlob("text/json;charset=UTF-8", $scope.wallet.toJSON());//未加密
			// $scope.blobEnc = globalFuncs.getBlob("text/json;charset=UTF-8", $scope.wallet.toV3(password, {
			// 	kdf: globalFuncs.kdf,
            //     n: globalFuncs.scrypt.n
			// }));//加密

            // $http({
            //     method: 'GET',
            //     url: $scope.blobEnc
            // }).then(function successCallback(response) {
            //     console.log(response)
            //     $scope.privateKeyEnc = response.data;
            // }, function errorCallback(response) {
            //     alert(JSON.stringify(response))
            // });
            $scope.privateKeyEnc = $scope.wallet.toV3(password, {
                kdf: globalFuncs.kdf,
                n: globalFuncs.scrypt.n
            });
            $scope.encFileName =  $scope.wallet.getV3Filename();
            $scope.isDone =  true;
        }
    }

    $scope.page = 1;
    $scope.getOrder = function(){
        Coinorders.get({'limit':5,'page':$scope.page}).$promise.then(function(res){
            console.log(res)
            $scope.orders = res;
        },function(msg){
            alert(JSON.stringify(msg))
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

    $scope.unbindWallet = function(){
        $scope.me.address = "";
        $scope.me.encrypted_wallet_key = "";
        Me.update($scope.me).$promise.then(function(res){
            $scope.me = res;
        },function(msg){
            alert(JSON.stringify(msg))
        })
    }

    $scope.bindExistWallet = function(address,key,password){
        var wallet = new Wallet(key);
        var privateKeyEnc = wallet.toV3(password, {
            kdf: globalFuncs.kdf,
            n: globalFuncs.scrypt.n
        });
        $scope.me.address = address;
        $scope.me.encrypted_wallet_key = JSON.stringify(privateKeyEnc);
        Me.update($scope.me).$promise.then(function(res){
            $scope.me = res;
        },function(msg){
            alert(JSON.stringify(msg))
        })
    }

    $scope.bindWallet = function(){
        $scope.me.address = $scope.wallet.getChecksumAddressString();
        $scope.me.encrypted_wallet_key = JSON.stringify($scope.privateKeyEnc);
        Me.update($scope.me).$promise.then(function(res){
            $scope.me = res;
        },function(msg){
            alert(JSON.stringify(msg))
        })
    }

    $scope.decryptWallet = function(password) {
		$scope.addWalletStats = "";
        try {
            var wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, password);
		} catch (e) {
			alert(e)
            return;
		}

        web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
        window.mdc.balances(wallet.getAddressString()).then(function(res){
            $scope.balance = ethUnits.toEther(res.toNumber(),'wei');
        })
        Ether.getBalance({'balance':wallet.getAddressString(),'isClassic':true}).$promise.then(function(res){
            $scope.wallet = res.data;
            $scope.showWalletInfo = true;
        },function(msg){
            alert(JSON.stringify(msg));
        })
	};

    $scope.recharge = function(joinPrice){
        Me.get().$promise.then(function(me){
            Coinorders.add({},{'coin':joinPrice}).$promise.then(function(data){
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
                                   alert("支付成功");
                                   $scope.getOrder()
                               }else{
                                   alert("支付失败");
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
                console.log('登录成功')
            },function(msg){
                console.log(msg)
            });
        })
    }
}])
;
