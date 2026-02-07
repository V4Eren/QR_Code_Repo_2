const NUMERIC_RE = /^\d*$/;
const ALPHANUMERIC_RE = /^[\dA-Z $%*+\-./:]*$/;
const LATIN1_RE = /^[\x00-\xff]*$/;
const KANJI_RE = /^[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]*$/u;

function getEncodingMode(string) {
    if(NUMERIC_RE.test(string)) return 0b0001;
    if(ALPHANUMERIC_RE.test(string)) return 0b0010;
    if(LATIN1_RE.test(string)) return 0b0100;
    if(KANJI_RE.test(string)) return 0b1000;

    //ECI condition
    return 0b0111;
}


const LENGTH_BITS = [
  //[Version 1-9, Version 10-16, Version 27-40]    
    [10, 12, 14], //numeric mode
    [9, 11, 13],  //alphanumeric mode
    [8, 16, 16],  //byte mode
    [8, 10, 12]   //kanji mode
];

function getLengthBits(mode, version) {
    const modeIndex = Math.floor(Math.log2(mode));
    const versionIndex = version > 26 ? 2 : (version > 10 ? 1 : 0);
    return LENGTH_BITS[modeIndex][versionIndex];
}

//byte encoding
function getByteData(str, bitLength, codewordLength){
    const data = new Uint8Array(codewordLength);
    const rightShift = 4; //First 4 bit is encoding mode
    const leftShift = 4;
    const andMask = (1 << rightShift) - 1;
    const dataIndexStart = bitLength > 12 ? 2 : 1;
    //console.log(rightShift)
    //console.log(leftShift)    
    data[0] = 64 + (str.length >> (bitLength - 4));
    //console.log(data[0])
    if(bitLength > 12) {
        data[1] = (str.length >> rightShift) & 255;
    } 
    data[dataIndexStart] = (str.length & andMask) << leftShift;
    
    for(let i = dataIndexStart; i < str.length + dataIndexStart; i++){
        const strByte = str.charCodeAt(i-dataIndexStart);
        data[i] |= strByte >> rightShift;
        data[i+1] =  (strByte & andMask) << leftShift
    }

    //fill the remaining bytes with 17 and 236
    const remaining = codewordLength - str.length - dataIndexStart - 1;
    //console.log(remaining)
    for(let i = 0; i < remaining; i++){
        //console.log(i);
        //first number is 236, then followed by 17, then repeat until the final length is reached
        const remainingByte = i & 1 ? 17 : 236;  
        data[i+str.length+2] = remainingByte;
    }

    return data;
}

//Galois field GF(256) exponents and log
const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
for(let n = 1, value = 1; n < 256; n++) {
    value = value > 127 ? (value << 1) ^ 285 : value << 1;
    EXP[n % 255] = value;
    LOG[value] = n % 255;
} 

//Multiplication and division in GF(256)
function GF256Mul(a, b) {
    const result = a && b > 0 ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
    return result;
} 

function GF256Div (a, b) {
    const result = LOG[(EXP[a] + EXP[b] * 254) % 255];
}

function polyMult (a, b) {
    const result = new Uint8Array(a.length + b.length - 1);
    for(let i = 0; i < a.length; i++) {
        for(let j = 0; j < b.length; j++) {
            result[i+j] ^= GF256Mul(a[i], b[j]);
        }
    }

    return result;

}

//console.log(polyMult([1,3,2], [1,4]));

function generatePolyForGF(codewords){
    let result = new Uint8Array([1]);
    for(let i = 0; i < codewords; i++) {
        //console.log(result);
        result = polyMult(result, new Uint8Array([1, EXP[i]]));
    }
    return result;
}


console.log(EXP);
console.log(LOG);
console.log(GF256Mul(3,4))
console.log(generatePolyForGF(16))

console.log(getByteData('https://www.qrcode.com/', 8, 28))
