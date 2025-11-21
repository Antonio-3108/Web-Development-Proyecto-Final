import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
interface PublicUser {
  username: string;
  bio?: string;
  profileImage?: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    mapsCreated: number;
    postsCreated: number;
  };
}
@Component({
  selector: 'app-public-profile',
  imports: [CommonModule, RouterLink],
  templateUrl: './public-profile.html',
  styleUrl: './public-profile.css',
})
export class PublicProfile implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';
  username: string = '';
  user: PublicUser | null = null;
  isLoading: boolean = true;
  notFound: boolean = false;
  ngOnInit() {
    this.route.params.subscribe(params => {
      this.username = params['username'];
      this.loadUserProfile();
    });
  }
  loadUserProfile() {
    this.isLoading = true;
    this.notFound = false;
    this.http.get(`${this.apiUrl}/users/username/${this.username}`).subscribe({
      next: (response: any) => {
        this.user = {
          username: response.username,
          bio: response.bio || 'Jugador de DashWare',
          profileImage: response.profileImage || '',
          stats: response.stats
        };
        this.isLoading = false;
      },
      error: (error) => {
        this.notFound = true;
        this.isLoading = false;
      }
    });
  }
  getProfileImageUrl(): string {
    if (this.user && this.user.profileImage) {
      return `http://localhost:3000${this.user.profileImage}`;
    }
    return '';
  }
}
