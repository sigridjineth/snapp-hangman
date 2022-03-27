import {
    Field,
    PublicKey,
    SmartContract,
    state,
    State,
    method,
    UInt64,
    Bool,
    Poseidon,
    Signature,
    Circuit
} from 'snarkyjs';

// We use this class to represent strings
// strings are represented as an array of characters
// Each character is encoded as a Field
// Character mapping / supported characters:
// a = 1
// b = 2
// ...
// z = 26
// _ = 27
// We can represent all 27 characters with 5 bits (charSize)
export class Word {
    value: Field[];
    static charSize = 5;

    // construct word from serialized field
    // we must know length to parse correct number of fields
    constructor(serializedWord: Field, length: Field) {
        const bits = serializedWord.toBits(Number(length.mul(Word.charSize)));
        let value = [];
        for (let i = 0; i < Number(length); i++) {
            value.push(
                Field.ofBits(
                    bits.slice(i * Word.charSize, i * Word.charSize + Word.charSize)
                )
            );
        }
        this.value = value;
    }

    // instatiate Word from string
    static fromString(word: string): Word {
        const chars = Array.from(word).map(Word.charToField);
        return new Word(Word.serialiseChars(chars), new Field(word.length));
    }

    // encode character as Field
    static charToField(char: string): Field {
        // Convert to ascii and shift for compression
        return new Field(char === '_' ? 27 : char.charCodeAt(0) - 96);
    }

    // decode character to Field
    static fieldToChar(field: Field): string {
        return Number(field) === 27 ? '_' : String.fromCharCode(Number(field) + 96);
    }

    // convert array of char fields to serialized word
    static serialiseChars(word: Field[]) {
        const bits = word.map((x) => x.toBits(Word.charSize)).flat();
        return Field.ofBits(bits);
    }

    // returns an array of type bool indicating if element at index matches char
    extractMatches(char: Field) {
        return this.value.map((x) => x.equals(char));
    }

    // we use this method to update guessed word to reveal correctly guessed characters
    updateWithMatches(word: Word, char: Field) {
        const matches = word.extractMatches(char);
        this.value = this.value.map((x, i) => Circuit.if(matches[i], char, x));
    }

    // compare with another Word instance
    equals(word: Word) {
        return this.value.map((x, i) => x.equals(word.value[i])).reduce(Bool.and);
    }

    // does word contain char
    hasMatches(char: Field) {
        return this.extractMatches(char).reduce(Bool.or);
    }

    // serialise to field
    serialise() {
        const bits = this.value.map((x) => x.toBits(Word.charSize)).flat();
        return Field.ofBits(bits);
    }

    // convert to a string
    toString() {
        return this.value.map((x) => Word.fieldToChar(x)).join('');
    }
}