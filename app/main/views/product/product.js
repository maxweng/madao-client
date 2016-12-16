ionicApp.controller('productCtrl', ['$scope','Ether','ethFuncs','ethUnits','Wechat','Me','web3Provider','Coinprice',
function($scope,Ether,ethFuncs,ethUnits,Wechat,Me,web3Provider,Coinprice){
    $scope.$on('$ionicView.beforeEnter', function(){
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
    });

    $scope.views = {
        'assistance':false,
        'problem':false
    }

    var wallet = '0x4db091998c8a6530c312211113844b34968fffb3';
    var privateKey = 'f0003dcea6610badbe043593e37ec4c2860f6acd29338626eb9e142992b9c250';
    web3Provider.init(wallet,privateKey);

    var getData = function(){
        Ether.getTransactionData({'txdata':wallet,'isClassic':true}).$promise.then(function(data){
            console.log('transactionData:')
            console.log(data)
            var rawTx = {
    			nonce: ethFuncs.sanitizeHex(data.data.nonce),
    			gasPrice: ethFuncs.sanitizeHex(ethFuncs.addTinyMoreToGas(data.data.gasprice)),
    			gasLimit: ethFuncs.sanitizeHex(ethFuncs.decimalToHex(1000000)),
    			to: ethFuncs.sanitizeHex(address),
    			value: ethFuncs.sanitizeHex(ethFuncs.decimalToHex(ethUnits.toWei(0, 'wei'))),
    			data: ethFuncs.sanitizeHex(window.ethUtil.sha3('totalAvailableUserAddresses').toString('hex').slice(0, 8))
    		}
            var eTx = new window.ethUtil.Tx(rawTx);
            eTx.sign(new BufferObject.Buffer(privateKey, 'hex'));
            //$scope.rawTx = JSON.stringify(rawTx);
    		$scope.signedTx = '0x' + eTx.serialize().toString('hex');
            Ether.sendRawTx({'rawtx':$scope.signedTx,'isClassic':true}).$promise.then(function(res){
                console.log('Tx:')
                console.log(res)
                Ether.getTransactionData({'txdata':res.data,'isClassic':true}).$promise.then(function(d){
                    console.log(d)
                });
            })
        })
    }
    //getData();
}])
;
