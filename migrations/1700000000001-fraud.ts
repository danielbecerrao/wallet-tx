import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000001 implements MigrationInterface {
  name = 'Init1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fraudAlert" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "userId" uuid NOT NULL,
        "transactionId" uuid NOT NULL,
        "reason" varchar(255) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_fraud_user_created" ON "fraudAlert" ("userId","createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fraud_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fraudAlert"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."transaction_type_enum"`,
    );
  }
}
