ionicApp.controller('productDetailCtrl', ['$scope','$state','Coinprice','tools','Me','Ether','web3Provider','ethFuncs',
'ethUnits','Coinorders','Coinordergetpayparams','Wechat','$ionicLoading','Wallet','walletManage',
function($scope,$state,Coinprice,tools,Me,Ether,web3Provider,ethFuncs,ethUnits,
    Coinorders,Coinordergetpayparams,Wechat,$ionicLoading,Wallet,walletManage){
    $scope.$on('$ionicView.beforeEnter', function(){
        walletManage($scope, function(modal){
            $scope.modal = modal;
            Me.get().$promise.then(function(me){
                $scope.me = me;
                if(!$scope.me.encrypted_wallet_key)$scope.modal.showModal();
                if(window.mdc&&$scope.$root.address&&$scope.$root.privateKey){

                }else{
                    var wallet;
                    var str=prompt("请先解锁钱包","");
                    if(str){
                        try {
                            wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, str);
                        } catch (e) {
                            alert(e)
                            $state.go("app.tabs.me")
                        }
                        web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
                    }else{
                        $state.go("app.tabs.me")
                    }
                }
                Coinprice.get().$promise.then(function(res){
                    $scope.advicedPrice = res.ethcny;
                    joinPrice = 1;
                },function(msg){
                    alert("获取ETH和RMB汇率失败")
                });
            },function(err){
                $scope.modal.showModal();
            })
        });
    });
    var joinPrice = -1;
    $scope.data = {};

    var bayCoin = function(joinPrice){
        if(!Wechat.hasAccessToken()){
            Wechat.getAccessToken();
            return;
        }
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
                                   $scope.join();
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

    $scope.join = function(){
        if(joinPrice<0){
            alert("汇率获取失败");
            return;
        }
        if(!$scope.data.name){
            alert("请填写姓名");
            return;
        }
        if(!$scope.data.country){
            alert("请填写国籍");
            return;
        }
        if(!$scope.data.id){
            alert("请填写身份证号");
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
                    alert("正在处理，可能需要几分钟请稍等")
                    $state.go('app.tabs.product');
                }else{
                    alert("加入成功")
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
                alert("钱包不存在或余额不足");
                bayCoin(joinPrice);
            }else{
                console.log(error)
                alert("请求失败");
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
