import { Field } from 'snarkyjs';

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
}
