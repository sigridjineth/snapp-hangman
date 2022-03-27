import {
    Field,
    Bool,
    Circuit
} from 'snarkyjs';

export default class Word {
    value: Field[];
    static charSize = 5;

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

    static fromString(word: string): Word {
        const chars = Array.from(word).map(Word.charToField);
        return new Word(Word.serialiseChars(chars), new Field(word.length));
    }

    static charToField(char: string): Field {
        return new Field(char === '_' ? 27 : char.charCodeAt(0) - 96);
    }

    static fieldToChar(field: Field): string {
        return Number(field) === 27 ? '_' : String.fromCharCode(Number(field) + 96);
    }

    static serialiseChars(word: Field[]) {
        const bits = word.map((x) => x.toBits(Word.charSize)).flat();
        return Field.ofBits(bits);
    }

    extractMatches(char: Field) {
        return this.value.map((x) => x.equals(char));
    }

    updateWithMatches(word: Word, char: Field) {
        const matches = word.extractMatches(char);
        this.value = this.value.map((x, i) => Circuit.if(matches[i], char, x));
    }

    equals(word: Word) {
        return this.value.map((x, i) => x.equals(word.value[i])).reduce(Bool.and);
    }

    hasMatches(char: Field) {
        return this.extractMatches(char).reduce(Bool.or);
    }

    serialise() {
        const bits = this.value.map((x) => x.toBits(Word.charSize)).flat();
        return Field.ofBits(bits);
    }

    toString() {
        return this.value.map((x) => Word.fieldToChar(x)).join('');
    }
}