import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_type_enum" AS ENUM ('deposit', 'withdraw');
    `);

    await queryRunner.query(`
      CREATE TABLE "userBalance" (
        "userId" uuid PRIMARY KEY,
        "balanceCents" bigint NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction" (
        "transactionId" uuid PRIMARY KEY,
        "userId" uuid NOT NULL,
        "amountCents" bigint NOT NULL,
        "type" "public"."transaction_type_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_tx_user_created" ON "transaction" ("userId","createdAt");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_tx_user_type" ON "transaction" ("userId","type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fraud_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tx_user_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tx_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "userBalance"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."transaction_type_enum"`,
    );
  }
}
