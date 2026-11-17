import { Injectable } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { KRONOS_FEATURES } from '../../kronos/kronos.features';

/**
 * Kronos no usa licencias enterprise de terceros: las funciones disponibles son
 * exactamente KRONOS_FEATURES. Se conserva la API del servicio porque varios
 * controladores consultan `hasFeature` para decidir qué opciones exponer.
 */
@Injectable()
export class LicenseCheckService {
  constructor(private environmentService: EnvironmentService) {}

  isValidEELicense(_licenseKey: string): boolean {
    return this.environmentService.isCloud();
  }

  hasFeature(_licenseKey: string, feature: string, _plan?: string): boolean {
    if (this.environmentService.isCloud()) return false;
    return KRONOS_FEATURES.includes(feature);
  }

  getFeatures(_licenseKey: string): string[] {
    return this.environmentService.isCloud() ? [] : [...KRONOS_FEATURES];
  }

  resolveFeatures(licenseKey: string, _plan: string): string[] {
    return this.getFeatures(licenseKey);
  }

  resolveTier(_licenseKey: string, plan: string): string {
    return this.environmentService.isCloud() ? (plan ?? 'standard') : 'free';
  }
}
