import { IUserAuth } from '../types';
export declare class UserRepository {
    private db;
    getByUsername(username: string): IUserAuth | undefined;
    upsert(username: string, passwordHash: string): void;
}
//# sourceMappingURL=user-repository.d.ts.map