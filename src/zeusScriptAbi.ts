// taken from `zeus-templates` repo.
export const abi = [
    {
      "type": "function",
      "name": "IS_SCRIPT",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "impl",
      "inputs": [
        {
          "name": "contractName",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "proxy",
      "inputs": [
        {
          "name": "contractName",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "zAddress",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "zBool",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "zDeployedContract",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "zString",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "zUint32",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "zUint64",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "zUpdate",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "value",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "zUpdate",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "value",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "zUpdate",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "value",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "zUpdateUint256",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "zUpdateUint32",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "value",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "zUpdateUint64",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "value",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "zeusTest",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "ZeusEnvironmentUpdate",
      "inputs": [
        {
          "name": "key",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        },
        {
          "name": "internalType",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum ZeusScript.EnvironmentVariableType"
        },
        {
          "name": "value",
          "type": "bytes",
          "indexed": false,
          "internalType": "bytes"
        }
      ],
      "anonymous": false
    }
  ] as const;