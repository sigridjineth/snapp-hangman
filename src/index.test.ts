import {
  Field,
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  UInt64,
  Party,
  Int64,
  Signature,
  PublicKey,
} from 'snarkyjs';
import { Word } from '../build/src/Word.js';
import { Hangman } from '../build/src/Hangman.js';

let playerOneInput: string = 'hello';
let playerOneWord: Word;

let playerTwoFirstInput: string = 'h';
let playerTwoFirstChar: Field;

let snappInstance: Hangman;
let wordLength: Field;

let Local: any;
let player1: any;
let player2: any;

let snappPrivkey: PrivateKey;
let snappPubkey: PublicKey;

let randomness: Field;
let guessLimit: Field;

describe('index.ts', () => {
  describe('check whether `hello` guess correct when guesser suggests `h`', () => {
    beforeAll(async () => {
      await isReady;

      console.log('Deploying contract');

      Local = Mina.LocalBlockchain();
      Mina.setActiveInstance(Local);

      player1 = Local.testAccounts[0].privateKey;
      player2 = Local.testAccounts[1].privateKey;

      snappPrivkey = PrivateKey.random();
      snappPubkey = snappPrivkey.toPublicKey();

      randomness = Field.random();
      guessLimit = new Field(5);

      playerOneWord = Word.fromString(playerOneInput);

      await Mina.transaction(player1, async () => {
        const amount = UInt64.fromNumber(10000000);
        const p = await Party.createSigned(player2);
        p.body.delta = Int64.fromUnsigned(amount).neg();

        snappInstance = new Hangman(
          amount,
          snappPubkey,
          player1.toPublicKey(),
          player2.toPublicKey(),
          playerOneWord,
          randomness,
          guessLimit
        );
      })
        .send()
        .wait();
    });
    afterAll(async () => {
      await shutdown();
    });
    it('should be correct', async () => {
      // when
      playerTwoFirstChar = Word.charToField(playerTwoFirstInput);

      await Mina.transaction(player2, async () => {
        const signature = Signature.create(player2, [playerTwoFirstChar]);
        await snappInstance.makeGuess(
          player2.toPublicKey(),
          signature,
          playerTwoFirstChar
        );
      })
        .send()
        .wait();

      await Mina.transaction(player1, async () => {
        const signature = Signature.create(
          player1,
          playerOneWord.value.concat([randomness])
        );
        await snappInstance.checkGuess(
          player1.toPublicKey(),
          signature,
          playerOneWord,
          randomness
        );
      })
        .send()
        .wait();

      await Mina.transaction(player2, async () => {
        wordLength = snappInstance.wordLength;
      })
        .send()
        .wait();

      // then
      let b = await Mina.getAccount(snappPubkey);
      let thisOutcome = Number(b.snapp.appState[4]);
      let guessedWord = new Word(b.snapp.appState[0], wordLength).toString();
      let lastGuess = Word.fieldToChar(b.snapp.appState[1]);
      let incorrectGuessCount = Number(b.snapp.appState[2]);

      expect(thisOutcome).toEqual(0);
      expect(guessedWord).toEqual(Word.fromString('h____').toString());
      expect(lastGuess).toEqual(Word.fromString('h').toString());
      expect(incorrectGuessCount).toEqual(0);
    });
  });
});
