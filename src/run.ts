import {
  Field,
  UInt64,
  Signature,
  isReady,
  Party,
  Int64,
  Mina,
  PrivateKey,
} from 'snarkyjs';
import readline from 'readline';

import Word from './Word';
import Hangman from './Hangman';

export default async function run() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const player1 = Local.testAccounts[0].privateKey;
  const player2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  const randomness = Field.random();
  const guessLimit = new Field(5);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let playerInput = await new Promise<string>((resolve) => {
    rl.question('Player 1 - Please choose your word: ', resolve);
  });
  let word = Word.fromString(playerInput);

  console.log('Deploying contract');
  let snappInstance: Hangman;
  let wordLength: Field;

  await Mina.transaction(player1, async () => {
    const amount = UInt64.fromNumber(10000000);
    const p = await Party.createSigned(player2);
    p.body.delta = Int64.fromUnsigned(amount).neg();

    snappInstance = new Hangman(
      amount,
      snappPubkey,
      player1.toPublicKey(),
      player2.toPublicKey(),
      word,
      randomness,
      guessLimit
    );
  })
    .send()
    .wait();

  await Mina.transaction(player2, async () => {
    wordLength = snappInstance.wordLength;
  })
    .send()
    .wait();

  function printGameStatus(appState: Field[]) {
    const guessedWord = new Word(appState[0], wordLength).toString();
    const lastGuess = Word.fieldToChar(appState[1]);
    const incorrectGuessCount = Number(appState[2]);
    const guessLimit = Number(appState[5]);
    console.log('-'.repeat(20));
    console.log('Word: ', guessedWord);
    console.log(`Last Guess: ${lastGuess}`);
    console.log(`Incorrect Guesses: ${incorrectGuessCount}`);
    console.log('-'.repeat(20));
  }

  console.log(`Player 2 you have ${guessLimit} lives - good luck!`);
  let gameOutcome = 0;

  while (gameOutcome === 0) {
    let playerInput = await new Promise<string>((resolve) => {
      rl.question('Player 2 - Please guess a letter: ', resolve);
    });
    let guessLetter = Word.charToField(playerInput);

    await Mina.transaction(player2, async () => {
      const signature = Signature.create(player2, [guessLetter]);
      await snappInstance.makeGuess(
        player2.toPublicKey(),
        signature,
        guessLetter
      );
    })
      .send()
      .wait();

    await Mina.transaction(player1, async () => {
      const signature = Signature.create(
        player1,
        word.value.concat([randomness])
      );
      await snappInstance.checkGuess(
        player1.toPublicKey(),
        signature,
        word,
        randomness
      );
    })
      .send()
      .wait();

    let b = await Mina.getAccount(snappPubkey);
    printGameStatus(b.snapp.appState);
    gameOutcome = Number(b.snapp.appState[4]);
  }
  console.log('The winner is Player: ', gameOutcome);
  rl.close();
}
