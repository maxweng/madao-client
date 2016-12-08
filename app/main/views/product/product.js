ionicApp.controller('productCtrl', ['$scope','Ether','ethFuncs','ethUnits','Wechat','Me',
function($scope,Ether,ethFuncs,ethUnits,Wechat,Me){
    $scope.$on('$ionicView.beforeEnter', function(){
        Me.get().$promise.then(function(me){
            $scope.me = me;
        },function(err){

        })
    });
    $scope.views = {
        'assistance':false,
        'problem':false
    }
    
    var address = '0xbd8cd235466416220ce1cd494dd50eb0006a3a19';
    var wallet = '0x9353d0a9ae06f455177d533bb966c67823d7ae28';
    var privateKey = '2dfa390856a5310addce7a07f38d5ade7084a97115b4c6b376acdb99ec70f003';

    var getData = function(){
        Ether.getBalance({'balance':address,'isClassic':true}).$promise.then(function(res){
            console.log('balance:')
            console.log(res)
        })

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
            $scope.rawTx = JSON.stringify(rawTx);
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



    // var web3 = new window.web3();
    // var MyContract = web3.eth.contract(abi);
    // var myContractInstance = MyContract.at(address);
    // console.log(myContractInstance);
    // console.log(myContractInstance.totalAvailableUserAddresses())
}])
;
