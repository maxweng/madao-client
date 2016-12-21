ionicApp.controller('productCtrl', ['$scope','$state','Ether','ethFuncs','ethUnits',
'Wechat','Me','web3Provider','Coinprice','Wallet',
function($scope,$state,Ether,ethFuncs,ethUnits,Wechat,Me,web3Provider,Coinprice,Wallet){
    $scope.$on('$ionicView.beforeEnter', function(){
        var getData = function(){
            Ether.getBalance({'balance':window.MDC.address,'isClassic':true}).$promise.then(function(res){
                $scope.totalBalance = res.data.balance;
            });

            Coinprice.get().$promise.then(function(res){
                $scope.advicedPrice = res.ethcny;
            },function(msg){
                console.log(msg)
                alert(JSON.stringify(msg))
            });

            window.mdc.totalAvailableUserAddresses().then(function(res){
                $scope.totalPeople = res.toNumber();
            })
        }

        if(!window.mdc){
            Me.get().$promise.then(function(res){
                $scope.me = res;
                var wallet;
                var str=prompt("请先解锁钱包","密码");
                if(str){
                    try {
                        wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, parseInt(str));
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
            var available = !!res[1];
            if(available){
                alert('已加入')
            }else{
                alert('未加入')
            }
        }).catch(function(err){
            console.log(err);
            alert('获取信息失败')
        });
    }

    // var wallet = '0x4db091998c8a6530c312211113844b34968fffb3';
    // var privateKey = 'f0003dcea6610badbe043593e37ec4c2860f6acd29338626eb9e142992b9c250';
    // web3Provider.init(wallet,privateKey);

    // var getData = function(){
    //     Ether.getTransactionData({'txdata':wallet,'isClassic':true}).$promise.then(function(data){
    //         console.log('transactionData:')
    //         console.log(data)
    //         var rawTx = {
    // 			nonce: ethFuncs.sanitizeHex(data.data.nonce),
    // 			gasPrice: ethFuncs.sanitizeHex(ethFuncs.addTinyMoreToGas(data.data.gasprice)),
    // 			gasLimit: ethFuncs.sanitizeHex(ethFuncs.decimalToHex(1000000)),
    // 			to: ethFuncs.sanitizeHex(address),
    // 			value: ethFuncs.sanitizeHex(ethFuncs.decimalToHex(ethUnits.toWei(0, 'wei'))),
    // 			data: ethFuncs.sanitizeHex(window.ethUtil.sha3('totalAvailableUserAddresses').toString('hex').slice(0, 8))
    // 		}
    //         var eTx = new window.ethUtil.Tx(rawTx);
    //         eTx.sign(new BufferObject.Buffer(privateKey, 'hex'));
    // 		$scope.signedTx = '0x' + eTx.serialize().toString('hex');
    //         Ether.sendRawTx({'rawtx':$scope.signedTx,'isClassic':true}).$promise.then(function(res){
    //             console.log('Tx:')
    //             console.log(res)
    //             Ether.getTransactionData({'txdata':res.data,'isClassic':true}).$promise.then(function(d){
    //                 console.log(d)
    //             });
    //         })
    //     })
    // }
}])
;
