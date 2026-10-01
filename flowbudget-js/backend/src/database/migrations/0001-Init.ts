import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1790842757874 implements MigrationInterface {
    name = 'Init1790842757874'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "currencies" ("code" character varying(3) NOT NULL, "name" character varying(50) NOT NULL, "country" character varying(50), CONSTRAINT "PK_9f8d0972aeeb5a2277e40332d29" PRIMARY KEY ("code"))`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(50) NOT NULL, "userId" character varying(64) NOT NULL, "currencyCode" character varying(3) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3aa23c0a6d107393e8b40e3e2a" ON "accounts"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(50) NOT NULL, "displayName" character varying(50) NOT NULL, "userId" character varying(64), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_13e8b2a21988bec6fdcbb1fa74" ON "categories"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "wishlists" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100) NOT NULL, "description" text, "imageUrl" text, "goal" numeric(18,2) NOT NULL, "targetDate" date NOT NULL, "mode" character varying(20) NOT NULL DEFAULT 'manual', "status" character varying(20) NOT NULL DEFAULT 'inactive', "accountId" uuid NOT NULL, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d0a37f2848c5d268d315325f359" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3e7e5f79da9d662a0f323fdab0" ON "wishlists"  ("accountId") `);
        await queryRunner.query(`CREATE TABLE "expenditures" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "date" date NOT NULL, "price" numeric(18,2) NOT NULL, "nameEnc" bytea NOT NULL, "descriptionEnc" bytea, "categoryId" uuid, "dailyExpenseId" uuid NOT NULL, "wishlistId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_876c24b19b0a53d9be374ab93b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3ffbeb56248f97b62456bfc16a" ON "expenditures"  ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_01d85e59366147ddc3f3c11b31" ON "expenditures"  ("dailyExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0f83d73146e7c47f7d18f75948" ON "expenditures"  ("wishlistId") `);
        await queryRunner.query(`CREATE TABLE "division_plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100) NOT NULL, "isActive" boolean NOT NULL DEFAULT false, "activeFrom" date, "accountId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_55b27df2a55674927d619f2b6ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dae0242af8d2d8129bbd8ffaa9" ON "division_plans"  ("accountId") `);
        await queryRunner.query(`CREATE TABLE "pockets" ("lineageId" uuid NOT NULL, "activeFrom" date NOT NULL, "isDeleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" uuid NOT NULL, "name" character varying(100) NOT NULL, "ration" double precision NOT NULL, "planId" uuid NOT NULL, CONSTRAINT "PK_0d31625105cd8f2774753d1046d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f473b62068594c420912a41a7b" ON "pockets"  ("lineageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2569eb407486d4171559c72fb6" ON "pockets"  ("planId") `);
        await queryRunner.query(`CREATE TABLE "daily_expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "date" date NOT NULL, "startAmount" numeric(18,2) NOT NULL, "eodAmount" numeric(18,2) NOT NULL, "relativeBudget" numeric(18,2) NOT NULL, "isStarted" boolean NOT NULL DEFAULT false, "pocketId" uuid NOT NULL, "wishlistId" uuid, "wishlistSweptAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_daily_expenses_pocket_date" UNIQUE ("pocketId", "date"), CONSTRAINT "PK_01ca887c20e021509862f0bda0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e9ba23db8f3e5b9e5fbf4f33cc" ON "daily_expenses"  ("wishlistId") `);
        await queryRunner.query(`CREATE TABLE "fixed_expenses" ("lineageId" uuid NOT NULL, "activeFrom" date NOT NULL, "isDeleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" uuid NOT NULL, "name" character varying(50) NOT NULL, "amount" numeric(18,2) NOT NULL, "accountId" uuid NOT NULL, CONSTRAINT "PK_dc4b92826670ae9b779ad9ebf90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3906c40ee6d5ee7606279dc69b" ON "fixed_expenses"  ("lineageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_28e9972adff66a7108532d1b7e" ON "fixed_expenses"  ("accountId") `);
        await queryRunner.query(`CREATE TABLE "incomes" ("lineageId" uuid NOT NULL, "activeFrom" date NOT NULL, "isDeleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" uuid NOT NULL, "name" character varying(50) NOT NULL, "amount" numeric(18,2) NOT NULL, "accountId" uuid NOT NULL, CONSTRAINT "PK_d737b3d0314c1f0da5461a55e5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fdc7191badf0a3f75e3ddecd28" ON "incomes"  ("lineageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bce0697ddfa691a90d08d12902" ON "incomes"  ("accountId") `);
        await queryRunner.query(`CREATE TABLE "user_profiles" ("userId" character varying(64) NOT NULL, "theme" character varying(10), "language" character varying(10), "apiKeyEnc" bytea, "wrappedDek" bytea NOT NULL, "kekVersion" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8481388d6325e752cd4d7e26c6d" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_69ae6cdefad607085b34e6673b6" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wishlists" ADD CONSTRAINT "FK_3e7e5f79da9d662a0f323fdab0a" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenditures" ADD CONSTRAINT "FK_bf5023141b14fc984632978bb41" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenditures" ADD CONSTRAINT "FK_01d85e59366147ddc3f3c11b31a" FOREIGN KEY ("dailyExpenseId") REFERENCES "daily_expenses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenditures" ADD CONSTRAINT "FK_0f83d73146e7c47f7d18f759486" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "division_plans" ADD CONSTRAINT "FK_dae0242af8d2d8129bbd8ffaa91" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pockets" ADD CONSTRAINT "FK_2569eb407486d4171559c72fb6f" FOREIGN KEY ("planId") REFERENCES "division_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_expenses" ADD CONSTRAINT "FK_537dcbcb2cbbe0e43d81c937338" FOREIGN KEY ("pocketId") REFERENCES "pockets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_expenses" ADD CONSTRAINT "FK_e9ba23db8f3e5b9e5fbf4f33cc4" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fixed_expenses" ADD CONSTRAINT "FK_28e9972adff66a7108532d1b7e7" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD CONSTRAINT "FK_bce0697ddfa691a90d08d12902b" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // Better Auth owns auth_user; it is created before the TypeORM migrations run.
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_user_profiles_auth_user" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_auth_user" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_auth_user" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_auth_user"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_accounts_auth_user"`);
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_user_profiles_auth_user"`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP CONSTRAINT "FK_bce0697ddfa691a90d08d12902b"`);
        await queryRunner.query(`ALTER TABLE "fixed_expenses" DROP CONSTRAINT "FK_28e9972adff66a7108532d1b7e7"`);
        await queryRunner.query(`ALTER TABLE "daily_expenses" DROP CONSTRAINT "FK_e9ba23db8f3e5b9e5fbf4f33cc4"`);
        await queryRunner.query(`ALTER TABLE "daily_expenses" DROP CONSTRAINT "FK_537dcbcb2cbbe0e43d81c937338"`);
        await queryRunner.query(`ALTER TABLE "pockets" DROP CONSTRAINT "FK_2569eb407486d4171559c72fb6f"`);
        await queryRunner.query(`ALTER TABLE "division_plans" DROP CONSTRAINT "FK_dae0242af8d2d8129bbd8ffaa91"`);
        await queryRunner.query(`ALTER TABLE "expenditures" DROP CONSTRAINT "FK_0f83d73146e7c47f7d18f759486"`);
        await queryRunner.query(`ALTER TABLE "expenditures" DROP CONSTRAINT "FK_01d85e59366147ddc3f3c11b31a"`);
        await queryRunner.query(`ALTER TABLE "expenditures" DROP CONSTRAINT "FK_bf5023141b14fc984632978bb41"`);
        await queryRunner.query(`ALTER TABLE "wishlists" DROP CONSTRAINT "FK_3e7e5f79da9d662a0f323fdab0a"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_69ae6cdefad607085b34e6673b6"`);
        await queryRunner.query(`DROP TABLE "user_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bce0697ddfa691a90d08d12902"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fdc7191badf0a3f75e3ddecd28"`);
        await queryRunner.query(`DROP TABLE "incomes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28e9972adff66a7108532d1b7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3906c40ee6d5ee7606279dc69b"`);
        await queryRunner.query(`DROP TABLE "fixed_expenses"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e9ba23db8f3e5b9e5fbf4f33cc"`);
        await queryRunner.query(`DROP TABLE "daily_expenses"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2569eb407486d4171559c72fb6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f473b62068594c420912a41a7b"`);
        await queryRunner.query(`DROP TABLE "pockets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dae0242af8d2d8129bbd8ffaa9"`);
        await queryRunner.query(`DROP TABLE "division_plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0f83d73146e7c47f7d18f75948"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_01d85e59366147ddc3f3c11b31"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ffbeb56248f97b62456bfc16a"`);
        await queryRunner.query(`DROP TABLE "expenditures"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e7e5f79da9d662a0f323fdab0"`);
        await queryRunner.query(`DROP TABLE "wishlists"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13e8b2a21988bec6fdcbb1fa74"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3aa23c0a6d107393e8b40e3e2a"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TABLE "currencies"`);
    }

}
