'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Edit, Github, Twitter, Globe, User, Award, Clock, Activity,
  Camera, X, Check, Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ProfileSkeleton, SectionError } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';
import { UserAgentRow, SwarmRow } from '@/lib/database.types';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile: authProfile, isLoading: authLoading, refreshProfile } = useAuth();
  const toast = useShowToast();
  
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    website: '',
    twitter: '',
    github: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/profile/edit');
    }
  }, [authLoading, user, router]);

  // Load profile data
  useEffect(() => {
    if (authProfile) {
      setFormData({
        display_name: authProfile.display_name || '',
        username: authProfile.username || '',
        bio: authProfile.bio || '',
        website: authProfile.website || '',
        twitter: authProfile.twitter || '',
        github: authProfile.github || '',
      });
      if (authProfile.avatar_url) {
        setAvatarPreview(authProfile.avatar_url);
      }
    }
  }, [authProfile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File too large', 'Please select an image under 2MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Invalid file', 'Please select an image file');
        return;
      }
      
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim()) {
      toast.error('Username required', 'Please enter a username');
      return;
    }

    setIsSaving(true);

    try {
      let avatarUrl = authProfile?.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', avatarFile);
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          avatarUrl = uploadData.url;
        } else {
          throw new Error('Failed to upload avatar');
        }
      }

      // Update profile
      const updateRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          avatar_url: avatarUrl,
        }),
      });

      if (updateRes.ok) {
        await refreshProfile();
        toast.success('Profile updated', 'Your changes have been saved');
        router.push('/profile');
      } else {
        const errorData = await updateRes.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
    } catch (err: any) {
      toast.error('Update failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-page py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Link 
          href="/profile"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-border-subtle rounded-2xl p-8"
        >
          <h1 className="text-2xl font-bold text-white mb-6">Edit Profile</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Avatar
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon-green to-cyan-blue flex items-center justify-center text-4xl overflow-hidden"
                  >
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{(formData.display_name || formData.username || '👤').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  
                  <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-bg-elevated border border-border-subtle rounded-full flex items-center justify-center cursor-pointer hover:border-neon-green transition-colors">
                    <Camera className="w-4 h-4 text-text-secondary" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                
                <p className="text-sm text-text-muted">
                  Click to upload a new avatar.\n                  Max 2MB, JPG/PNG/WebP.
                </p>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Username *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">@</span>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="johndoe"
                  className="w-full pl-8 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted resize-none"
              />
              <p className="text-xs text-text-muted mt-1">{formData.bio.length}/500</p>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Website
              </label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full pl-12 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Twitter
                </label>
                <div className="relative">
                  <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    placeholder="username"
                    className="w-full pl-12 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  GitHub
                </label>
                <div className="relative">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={formData.github}
                    onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                    placeholder="username"
                    className="w-full pl-12 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
              
              <Link
                href="/profile"
                className="flex items-center justify-center gap-2 px-6 py-3 border border-border-subtle rounded-xl text-text-secondary hover:text-white hover:border-white transition-colors"
              >
                <X className="w-5 h-5" />
                Cancel
              </Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
