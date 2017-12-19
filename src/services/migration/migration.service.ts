import {Connection, getConnection, QueryRunner} from "typeorm";
import {Inject, Injectable} from "@angular/core";
import {PEGASUS_CONNECTION_NAME} from "../../config/typeORM-config";
import {
  DBMigration, Migration, MIGRATION_SUPPLIER, MigrationError, MigrationSupplier,
  MigrationVersion
} from "./migration.api";
import {InitDatabase} from "../../migrations/V__1-init-database";
import {AddObjectAttributes} from "../../migrations/V__2-add-object-attributes";
import {Logger} from "../logging/logging.api";
import {Logging} from "../logging/logging.service";

/**
 * DB Migration with TypeORM.
 *
 * @author nmaerchy <nm@studer-raimann.ch>
 * @version 2.0.0
 */
@Injectable()
export class TypeOrmDbMigration implements DBMigration {

  private readonly log: Logger = Logging.getLogger(TypeOrmDbMigration.name);

  constructor(
    @Inject(MIGRATION_SUPPLIER) private readonly migrationSupplier: MigrationSupplier
  ) {}

  /**
   * Migrates the database with all migrations found by the {@link MigrationSupplier}.
   *
   * @throws {MigrationError} if the migration fails
   */
  async migrate(): Promise<void> {

    try {

      const connection: Connection = getConnection(PEGASUS_CONNECTION_NAME);

      const queryRunner: QueryRunner = connection.createQueryRunner();

      const migrationTable: CreateMigrationTable = new CreateMigrationTable();
      await migrationTable.up(queryRunner);

      const migrations: Array<Migration> = await this.migrationSupplier.get();
      migrations.sort((first, second) => this.sort(first.version, second.version));

      migrations.forEach(async(it) => {

        const result: Array<{}> = await queryRunner.query("SELECT * FROM migrations WHERE id = ?", [it.version.getVersion()]);
        if (result.length < 1) {

          this.log.info(() => `Run database migration: version=${it.version.getVersion()}`);
          await it.up(queryRunner);

          await queryRunner.query("INSERT INTO migrations (id) VALUES (?)", [it.version.getVersion()])
        }
      });

      this.log.info(() => "Successfully migrate database");

    } catch (error) {
      throw new MigrationError("Could not finish database migration");
    }
  }

  /**
   * Reverts the last n steps with typeORM connection.
   *
   * @param {number} steps - step count to revert
   *
   * @throws {MigrationError} if a revert step fails
   */
  async revert(steps: number): Promise<void> {

    let currentStep: number = 0;

    try {

      const connection: Connection = getConnection(PEGASUS_CONNECTION_NAME);

      const queryRunner: QueryRunner = connection.createQueryRunner();

      const migrations: Array<Migration> = await this.migrationSupplier.get();

      for(;currentStep < steps; currentStep++) {

        const migration: Migration = migrations.pop();

        await migration.down(queryRunner);
        await queryRunner.query("DELETE FROM migrations WHERE id = ?", [migration.version.getVersion()])
      }

      this.log.info(() => `Successfully revert ${steps} database migrations`);

    } catch (error) {
      throw new MigrationError(`Could not revert step ${currentStep}`);
    }
  }

  /**
   * Comparator for {@link MigrationVersion}.
   *
   * Returns negative number if {@code first} is before {@code second}.
   * Returns positive number if {@code first} is after {@code second}.
   * Returns 0 if {@code first} is equal to {@code second}.
   *
   * @param {MigrationVersion} first - migration to compare with
   * @param {MigrationVersion} second - other migration
   *
   * @returns {number} the resulting number
   */
  private sort(first: MigrationVersion, second: MigrationVersion): number {

    if (first.getVersion() < second.getVersion()) {
      return -1;
    }

    if (first.getVersion() > second.getVersion()) {
      return 1;
    }

    return 0;
  }
}

/**
 * A simple migration supplier, that supplies migrations,
 * that are created in this class.
 *
 * @author nmaerchy <nm@studer-raimann.ch>
 * @version 1.0.0
 */
@Injectable()
export class SimpleMigrationSupplier implements MigrationSupplier {

  /**
   * Returns all migration that are being executed by the {@link DBMigration}.
   *
   * @returns {Promise<Array<Migration>>} the migrations to run
   */
  async get(): Promise<Array<Migration>> {
    return [
      new InitDatabase(),
      new AddObjectAttributes()
    ];
  }
}

/**
 * Special migration, which setups the migration table,
 * to execute further migrations.
 *
 * @author nmaerchy <nm@studer-raimann.ch>
 * @version 1.0.0
 */
class CreateMigrationTable implements Migration {

  readonly version: MigrationVersion = new MigrationVersion("V__0");

  /**
   * Creates the migration table, in which all migrations will be write in.
   *
   * @param {QueryRunner} queryRunner - to execute sql queries
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TABLE IF NOT EXISTS migrations (id INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
  }

  /**
   * Deletes the migration table.
   *
   * @param {QueryRunner} queryRunner - to execute sql queries
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE TABLE migrations");
  }
}
