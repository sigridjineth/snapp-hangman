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
}
