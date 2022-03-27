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

export default class Hangman extends SmartContract {
    // we store the guessed word on chain and update as characters are correctly guessed
    @state(Field) guessedWord: State<Field>;
    // we store prior guessed chracter on chain such that player 1 can check if exists in word
    @state(Field) guessedChar: State<Field>;
    // keep count of incorect guesses
    @state(Field) incorrectGuessCount: State<Field>;
    // indicates who is next
    @state(Bool) nextPlayer: State<Bool>;
    // represents outcome of game
    // 0 = ongoing
    // 1 = player 1 wins
    // 2 = player 2 wins
    @state(Field) gameOutcome: State<Field>;
    // how many incorrect guesses until player 2 loses
    incorrectGuessLimit: Field;
    // how long is the input word - used for deterministic iteration
    wordLength: Field;
    // player keys
    player1: PublicKey;
    player2: PublicKey;
    // commitment of input word
    wordCommitment: Field;

    constructor(
        initialBalance: UInt64,
        address: PublicKey,
        player1: PublicKey,
        player2: PublicKey,
        word: Word,
        randomness: Field,
        guessLimit: Field
    ) {
        super(address);
        this.balance.addInPlace(initialBalance);
        this.guessedWord = State.init(
            Word.fromString('_'.repeat(word.value.length)).serialise()
        );
        this.guessedChar = State.init(Field.zero);
        this.incorrectGuessCount = State.init(Field.zero);
        this.nextPlayer = State.init(new Bool(true));
        this.gameOutcome = State.init(Field.zero);
        this.wordLength = new Field(word.value.length);
        this.wordCommitment = new Field(
            Poseidon.hash(word.value.concat([randomness]))
        );
        this.incorrectGuessLimit = new Field(guessLimit);
        this.player1 = player1;
        this.player2 = player2;
    }

    @method async makeGuess(pubkey: PublicKey, sig: Signature, guessChar: Field) {
        // Assert game is not complete
        const gameOutcome = await this.gameOutcome.get();
        gameOutcome.assertEquals(Field.zero);

        // Only player 2 can make guesses
        pubkey.assertEquals(this.player2);

        // check if its player 2's turn
        const nextPlayer = await this.nextPlayer.get();
        nextPlayer.assertEquals(true);

        // Verify sig
        sig.verify(pubkey, [guessChar]).assertEquals(true);

        // Submit guessed character
        this.guessedChar.set(guessChar);

        // Update nextPlayer
        this.nextPlayer.set(new Bool(false));
    }

    @method async checkGuess(
        pubkey: PublicKey,
        sig: Signature,
        word: Word,
        randomness: Field
    ) {
        // Assert game is not complete
        let gameOutcome = await this.gameOutcome.get();
        gameOutcome.assertEquals(Field.zero);

        // Only player 1 can check guesses
        pubkey.assertEquals(this.player1);

        // Is it player 1's turn?
        const nextPlayer = await this.nextPlayer.get();
        nextPlayer.assertEquals(false);

        // Verify sig
        sig.verify(pubkey, word.value.concat([randomness])).assertEquals(true);

        // Verify word
        Poseidon.hash(word.value.concat([randomness])).assertEquals(
            this.wordCommitment
        );

        // check guessedWord
        let guessedLetter = await this.guessedChar.get();
        const hasMatches = word.hasMatches(guessedLetter);

        // increment incorrect counter
        const incorrectGuessCount = await this.incorrectGuessCount.get();
        const updatedIncorrectGuessCount = Circuit.if(
            hasMatches,
            incorrectGuessCount,
            incorrectGuessCount.add(1)
        );
        this.incorrectGuessCount.set(updatedIncorrectGuessCount);

        // update guessed word
        let guessedWord = new Word(await this.guessedWord.get(), this.wordLength);
        guessedWord.updateWithMatches(word, guessedLetter);
        this.guessedWord.set(guessedWord.serialise());

        // determine game outcome
        const wordFound = guessedWord.equals(word);
        gameOutcome = Circuit.if(
            updatedIncorrectGuessCount.equals(this.incorrectGuessLimit),
            new Field(1),
            gameOutcome
        );
        gameOutcome = Circuit.if(wordFound, new Field(2), gameOutcome);
        this.gameOutcome.set(gameOutcome);

        // iterate to next player
        this.nextPlayer.set(new Bool(true));
    }
}
