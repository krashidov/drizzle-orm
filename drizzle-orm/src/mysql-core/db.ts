import type { ResultSetHeader } from 'mysql2/promise';
import type { QueryBuilder } from '~/query-builders/query-builder';
import type { SQLWrapper } from '~/sql';
import { SelectionProxyHandler, WithSubquery } from '~/subquery';
import { type ColumnsSelection } from '~/view';
import type { MySqlDialect } from './dialect';
import type { QueryBuilderInstance } from './query-builders';
import {
	MySqlDelete,
	MySqlInsertBuilder,
	MySqlSelectBuilder,
	MySqlUpdateBuilder,
	queryBuilder,
} from './query-builders';
import type { SelectedFields } from './query-builders/select.types';
import type {
	MySqlSession,
	MySqlTransaction,
	MySqlTransactionConfig,
	PreparedQueryHKTBase,
	QueryResultHKT,
	QueryResultKind,
} from './session';
import type { WithSubqueryWithSelection } from './subquery';
import type { AnyMySqlTable } from './table';

export class MySqlDatabase<
	TQueryResult extends QueryResultHKT,
	TPreparedQueryHKT extends PreparedQueryHKTBase,
> {
	constructor(
		/** @internal */
		readonly dialect: MySqlDialect,
		/** @internal */
		readonly session: MySqlSession<any, any>,
	) {}

	$with<TAlias extends string>(alias: TAlias) {
		return {
			as<TSelection extends ColumnsSelection>(
				qb: QueryBuilder<TSelection> | ((qb: QueryBuilderInstance) => QueryBuilder<TSelection>),
			): WithSubqueryWithSelection<TSelection, TAlias> {
				if (typeof qb === 'function') {
					qb = qb(queryBuilder);
				}

				return new Proxy(
					new WithSubquery(qb.getSQL(), qb.getSelectedFields() as SelectedFields, alias, true),
					new SelectionProxyHandler({ alias, sqlAliasedBehavior: 'alias', sqlBehavior: 'error' }),
				) as WithSubqueryWithSelection<TSelection, TAlias>;
			},
		};
	}

	with(...queries: WithSubquery[]) {
		const self = this;

		function select(): MySqlSelectBuilder<undefined, TPreparedQueryHKT>;
		function select<TSelection extends SelectedFields>(
			fields: TSelection,
		): MySqlSelectBuilder<TSelection, TPreparedQueryHKT>;
		function select(fields?: SelectedFields): MySqlSelectBuilder<SelectedFields | undefined, TPreparedQueryHKT> {
			return new MySqlSelectBuilder(fields ?? undefined, self.session, self.dialect, queries);
		}

		return { select };
	}

	select(): MySqlSelectBuilder<undefined, TPreparedQueryHKT>;
	select<TSelection extends SelectedFields>(fields: TSelection): MySqlSelectBuilder<TSelection, TPreparedQueryHKT>;
	select(fields?: SelectedFields): MySqlSelectBuilder<SelectedFields | undefined, TPreparedQueryHKT> {
		return new MySqlSelectBuilder(fields ?? undefined, this.session, this.dialect);
	}

	update<TTable extends AnyMySqlTable>(table: TTable): MySqlUpdateBuilder<TTable, TQueryResult, TPreparedQueryHKT> {
		return new MySqlUpdateBuilder(table, this.session, this.dialect);
	}

	insert<TTable extends AnyMySqlTable>(table: TTable): MySqlInsertBuilder<TTable, TQueryResult, TPreparedQueryHKT> {
		return new MySqlInsertBuilder(table, this.session, this.dialect);
	}

	delete<TTable extends AnyMySqlTable>(table: TTable): MySqlDelete<TTable, TQueryResult, TPreparedQueryHKT> {
		return new MySqlDelete(table, this.session, this.dialect);
	}

	execute<T extends { [column: string]: any } = ResultSetHeader>(
		query: SQLWrapper,
	): Promise<QueryResultKind<TQueryResult, T>> {
		return this.session.execute(query.getSQL());
	}

	transaction<T>(
		transaction: (tx: MySqlTransaction<TQueryResult, TPreparedQueryHKT>, config?: MySqlTransactionConfig) => Promise<T>,
		config?: MySqlTransactionConfig,
	): Promise<T> {
		return this.session.transaction(transaction, config);
	}
}
