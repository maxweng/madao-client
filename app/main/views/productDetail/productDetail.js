ionicApp.controller('productDetailCtrl', ['$scope','Coinprice','tools','Me','Ether','web3Provider','ethFuncs',
'ethUnits','Coinorders','Coinordergetpayparams','Wechat',
function($scope,Coinprice,tools,Me,Ether,web3Provider,ethFuncs,ethUnits,Coinorders,Coinordergetpayparams,Wechat){
    $scope.$on('$ionicView.beforeEnter', function(){
        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
            joinPrice = 1;
        },function(msg){
            alert(JSON.stringify(msg))
        });
    });
    var joinPrice = -1;
    $scope.data = {};

    var bayCoin = function(joinPrice){
        Me.get().$promise.then(function(me){
            Coinorders.add({},{'coin':joinPrice}).$promise.then(function(data){
                if(!Wechat.hasAccessToken())Wechat.getAccessToken();
                Coinordergetpayparams.add({'access_token':WXOauth.oauthData.access_token,'openid':WXOauth.oauthData.openid,'out_trade_no':data.out_trade_no},{}).$promise.then(function(data1){
                    var onBridgeReady = function(){
                       WeixinJSBridge.invoke(
                           'getBrandWCPayRequest', data1, function(res){
                               if(res.err_msg == "get_brand_wcpay_request:ok" ) {
                                   alert("pay succeeded");
                               }else{
                                   alert("pay failed");
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

        var id = tools.hexEncode($scope.data.id);
        $scope.data.noncestr = tools.noncestr($scope.$root.address);
        window.mdc.signUp($scope.data.recommender || "", $scope.data.name, $scope.data.country, id, $scope.data.noncestr, { from: $scope.$root.address, value: ethUnits.toWei(joinPrice,"ether"),'gasLimit':1000000,'gasPrice':20000000000}).then(function (transactionId) {
            console.log('Sign up transaction ID: ', '' + transactionId);
            Ether.getTransaction({'txId':transactionId,'isClassic':true}).$promise.then(function(res){
                if(res.data.transactionIndex==0){
                    alert("加入成功")
                }else{
                    alert("加入失败")
                }
            },function(err){
                alert(err.message);
            });
        }).catch(function(error){
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
