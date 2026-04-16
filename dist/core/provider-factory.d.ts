import { IProvider } from './provider-interface';
import { ModelTier } from '../types';
export interface ProviderStatus {
    name: string;
    configured: boolean;
}
export declare class ProviderFactory {
    /** Returns configuration status for all known providers (API key present or not). */
    static getProvidersStatus(): ProviderStatus[];
    static getProvider(name: string, tier?: ModelTier): IProvider;
}
//# sourceMappingURL=provider-factory.d.ts.map