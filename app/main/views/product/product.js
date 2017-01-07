ionicApp.controller('productCtrl', ['$scope','$state','Ether','ethFuncs','ethUnits',
'Wechat','Me','web3Provider','Coinprice','Wallet','tools','Coinorders','Coinordergetpayparams','$ionicLoading','walletManage','$ionicPopup','$q',
function($scope,$state,Ether,ethFuncs,ethUnits,Wechat,Me,web3Provider,Coinprice,
    Wallet,tools,Coinorders,Coinordergetpayparams,$ionicLoading,walletManage,$ionicPopup,$q){
    $scope.$on('$ionicView.beforeEnter', function(){
        walletManage($scope, function(modal){
            $scope.modal = modal;
        });
        if(!window.mdc){
            Me.get().$promise.then(function(me){
                $scope.me = me;
                web3Provider.init($scope.me.address,'');
                getData();
            },function(err){
                web3Provider.init("","",true);
                getData();
            })
        }else{
            getData();
        }
    });

    var getData = function(){
        Ether.getBalance({'balance':window.MDC.address,'isClassic':true}).$promise.then(function(res){
            $scope.totalBalance = res.data.balance;
        });

        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
            joinPrice = 1;
        },function(msg){
            console.log(msg)
            // alert($scope.$root.language.errMsg7)
        });

        window.mdc.totalAvailableUserAddresses().then(function(res){
            $scope.totalPeople = res.toNumber();
        })

        window.mdc.balances($scope.$root.address).then(function(res){
            $scope.balance = res.toNumber();
        })

        window.mdc.infoHashes.call($scope.$root.address).then(function (res) {
            var infoHash = "" + res[0];
            var available = !!res[1];
            if(available){
                $scope.showRenewals = true;
            }else if(window.web3.toDecimal(res[0])==0){
                $scope.showRenewals = false;
            }else{
                $scope.showRenewals = true;
            }
        }).catch(function(err){

        });
    }

    $scope.views = {
        'assistance':false,
        'problem':false
    }

    $scope.viewStatus = function(){
        window.mdc.infoHashes.call($scope.$root.address).then(function (res) {
            var infoHash = "" + res[0];
            var available = !!res[1];
            if(available){
                alert($scope.$root.language.tipMsg5)
            }else if(res[0]=="0x"||window.web3.toDecimal(res[0])==0){
                alert($scope.$root.language.errMsg9)
            }else{
                alert($scope.$root.language.errMsg10)
            }
        }).catch(function(err){
            console.log(err);
            alert($scope.$root.language.errMsg8)
        });
    }

    var joinPrice = -1;
    var bayCoin = function(joinPrice){
        if(!Wechat.hasAccessToken()){
            Wechat.getAccessToken();
            return;
        }
        Me.get().$promise.then(function(me){
            Coinorders.add({},{'coin':(joinPrice+0.2)}).$promise.then(function(data){
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
    $scope.data = {};
    var decryptWallet = function(){
        var deferred = $q.defer();
        if(!$scope.me||!$scope.me.encrypted_wallet_key){
            $scope.modal.showModal();
            deferred.resolve(true);
        }else if(window.mdc&&$scope.$root.address&&$scope.$root.privateKey){
            deferred.resolve(false);
        }else {
            var wallet;
            $ionicPopup.prompt({
                title: $scope.$root.language.tip10,
                inputType: 'password',
                okText: $scope.$root.language.save,
                cancelText: $scope.$root.language.cancel
            }).then(function(srt){
                if(str){
                    try {
                        wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, str);
                    } catch (e) {
                        alert(e)
                        $scope.modal.showModal();
                        return true;
                    }
                    web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
                    return false;
                }else{
                    $scope.modal.showModal();
                    return true;
                }
            }).then(function(result){
                deferred.resolve(result);
            });
        }
        
        return deferred.promise;
    }
    $scope.renewals = function(){
        decryptWallet().then(function(result){
            if(!result){
                if(joinPrice<0){
                    alert($scope.$root.language.errMsg7);
                    return;
                }
                Me.get().$promise.then(function(res){
                    $scope.me = res;
                    $scope.data.name = $scope.me.real_name;
                    $scope.data.country = $scope.me.country;
                    $scope.data.id = $scope.me.id_no;
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
                            }else{
                                alert($scope.$root.language.tipMsg7)
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
                            alert($scope.$root.language.errMsg16);
                            bayCoin(joinPrice);
                        }else{
                            console.log(error)
                            alert($scope.$root.language.errMsg15);
                        }
                    });
                },function(err){
                    Wechat.loginWechat(function(){
                        console.log($scope.$root.language.tipMsg4)
                    },function(msg){
                        console.log(msg)
                    });
                });
            }
        });
    };

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
