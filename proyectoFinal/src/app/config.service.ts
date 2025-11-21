import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  readonly apiUrl = environment.apiUrl;
  
  getApiUrl(): string {
    return this.apiUrl;
  }
  
  getFullUrl(path: string): string {
    return `${this.apiUrl}${path}`;
  }
  
  getAssetUrl(path: string): string {
    return environment.production 
      ? `https://your-backend-url.vercel.app${path}`
      : `http://localhost:3000${path}`;
  }
}
