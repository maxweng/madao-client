ionicApp.controller('productCtrl', ['$scope','Ether','ethFuncs','ethUnits','Wechat','Me',
function($scope,Ether,ethFuncs,ethUnits,Wechat,Me){
    $scope.views = {
        'assistance':false,
        'problem':false
    }

    Wechat.loginWechat(function(){
        alert('success')
        Me.get().$promise.then(function(){
            console.log('Mesuccess');
        },function(err){
            console.log(err.message)
        })
    },function(msg){
        alert(msg)
    });

    var address = '0x219a7AAd9d6d4a4012358B517a1ec983baF01413';
    var wallet = '0x080cc846cf4aba032f74adf0abc3d065b87dd650';
    var privateKey = 'b35e22422c47df7da611be662cfcd8e94f5e1255d1ebf6f6dfe33846694e1bd9';

    var getData = function(){
        Ether.getBalance({'balance':address,'isClassic':true}).$promise.then(function(res){
            //console.log(res)
        })

        Ether.getTransactionData({'txdata':wallet,'isClassic':true}).$promise.then(function(data){
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
                console.log(res)
                Ether.getTransactionData({'txdata':res.data,'isClassic':true}).$promise.then(function(d){
                    console.log(d)
                });
            })
        })
    }
}])
;
