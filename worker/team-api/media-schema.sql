-- تکه‌های عکس و فیلم سامانه نواقص هتل‌ها (جدا از پایگاه اصلی تا حجمشان به آن فشار نیاورد؛ بعد از ۷ روز پاک می‌شوند)
CREATE TABLE IF NOT EXISTS chunks (k TEXT NOT NULL, i INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (k, i));
