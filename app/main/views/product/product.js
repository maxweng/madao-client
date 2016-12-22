ionicApp.controller('productCtrl', ['$scope','$state','Ether','ethFuncs','ethUnits',
'Wechat','Me','web3Provider','Coinprice','Wallet','tools','Coinorders','Coinordergetpayparams','$ionicLoading',
function($scope,$state,Ether,ethFuncs,ethUnits,Wechat,Me,web3Provider,Coinprice,
    Wallet,tools,Coinorders,Coinordergetpayparams,$ionicLoading){
    $scope.$on('$ionicView.beforeEnter', function(){
        var getData = function(){
            Ether.getBalance({'balance':window.MDC.address,'isClassic':true}).$promise.then(function(res){
                $scope.totalBalance = res.data.balance;
            });

            Coinprice.get().$promise.then(function(res){
                $scope.advicedPrice = res.ethcny;
                joinPrice = 1;
            },function(msg){
                console.log(msg)
                alert(JSON.stringify(msg))
            });

            window.mdc.totalAvailableUserAddresses().then(function(res){
                $scope.totalPeople = res.toNumber();
            })

            window.mdc.balances($scope.$root.address).then(function(res){
                $scope.balance = res.toNumber();
            })
        }

        if(!window.mdc){
            Me.get().$promise.then(function(res){
                $scope.me = res;
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
                    getData();
                }else{
                    $state.go("app.tabs.me")
                }
            },function(err){
                Wechat.loginWechat(function(){
                    console.log('登录成功')
                },function(msg){
                    console.log(msg)
                });
            })
        }else{
            getData();
        }
    });

    $scope.views = {
        'assistance':false,
        'problem':false
    }

    $scope.viewStatus = function(){
        window.mdc.infoHashes.call($scope.$root.address).then(function (res) {
            var infoHash = "" + res[0];
            var available = !!res[1];
            if(available){
                alert('已加入')
            }else if(window.web3.toDecimal(res[0])==0){
                alert('未加入')
            }else{
                alert('余额不足，请续费')
            }
        }).catch(function(err){
            console.log(err);
            alert('获取信息失败')
        });
    }

    var joinPrice = -1;
    var bayCoin = function(joinPrice){
        if(!Wechat.hasAccessToken()){
            Wechat.getAccessToken();
            return;
        }
        Me.get().$promise.then(function(me){
            Coinorders.add({},{'coin':joinPrice}).$promise.then(function(data){
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
                    var onBridgeReady = function(){
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
    $scope.data = {};
    $scope.renewals = function(){
        if(joinPrice<0){
            alert("汇率获取失败");
            return;
        }
        Me.get().$promise.then(function(res){
            $scope.me = res;
            $scope.data.name = $scope.me.real_name;
            $scope.data.country = $scope.me.country;
            $scope.data.id = $scope.me.id_no;
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
                    }else{
                        alert("续费成功")
                    }
                    window.mdc.balances($scope.$root.address).then(function(res){
                        $scope.balance = res.toNumber();
                        $scope.$apply();
                    })
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
        },function(err){
            Wechat.loginWechat(function(){
                console.log('登录成功')
            },function(msg){
                console.log(msg)
            });
        })
    }

    // var getData = function(){
    //     var rawTx = {
    //         nonce: ethFuncs.sanitizeHex(tools.noncestr($scope.$root.address)),
    //         gasPrice: 1,
    //         gasLimit: 20000000,
    //         to: ethFuncs.sanitizeHex($scope.$root.address),
    //         value: ethFuncs.sanitizeHex(ethFuncs.decimalToHex(ethUnits.toWei(0, 'wei'))),
    //         data: ethFuncs.sanitizeHex(window.ethUtil.sha3('totalAvailableUserAddresses').toString('hex').slice(0, 8))
    //     }
    //     var eTx = new window.ethUtil.Tx(rawTx);
    //     eTx.sign(new BufferObject.Buffer($scope.$root.privateKey, 'hex'));
    //     $scope.signedTx = '0x' + eTx.serialize().toString('hex');
    //     Ether.sendRawTx({'rawtx':$scope.signedTx,'isClassic':true}).$promise.then(function(res){
    //         console.log('Tx:')
    //         console.log(res)
    //     })
    // }
    // getData();
}])
;
