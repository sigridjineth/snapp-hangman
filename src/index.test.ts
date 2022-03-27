import { Field, isReady, shutdown } from 'snarkyjs';
import { Word } from './index';

describe('index.ts', () => {
  describe('foo()', () => {
    beforeAll(async () => {
      await isReady;
      new Word(Field('a'), Field(1));
    });
    afterAll(async () => {
      await shutdown();
    });
    it('should be correct', async () => {
      expect(Field(1).add(1)).toEqual(Field(2));
    });
  });
});
