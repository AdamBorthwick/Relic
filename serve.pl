use strict;
use warnings;
use HTTP::Daemon;
use HTTP::Status;
use File::Basename;
use MIME::Base64;

my $port = 5173;
my $root = dirname(__FILE__) . '/ui_kits/stub';

my %mime = (
  html => 'text/html',
  css  => 'text/css',
  js   => 'application/javascript',
  jsx  => 'application/javascript',
  png  => 'image/png',
  jpg  => 'image/jpeg',
  svg  => 'image/svg+xml',
  woff2 => 'font/woff2',
  woff  => 'font/woff',
  ttf   => 'font/ttf',
  json => 'application/json',
  ico  => 'image/x-icon',
);

my $d = HTTP::Daemon->new(LocalPort => $port, ReuseAddr => 1) or die "Cannot bind: $!";
print "Serving $root on http://localhost:$port\n";

while (my $c = $d->accept) {
  while (my $r = $c->get_request) {
    my $path = $r->url->path;
    $path =~ s|/+|/|g;
    $path = '/creator.html' if $path eq '/';
    my $file = $root . $path;
    $file =~ s|[?#].*||;
    if (-f $file) {
      my ($ext) = $file =~ /\.(\w+)$/;
      my $ct = $mime{lc($ext) // ''} // 'application/octet-stream';
      open my $fh, '<:raw', $file or next;
      local $/; my $body = <$fh>; close $fh;
      my $res = HTTP::Response->new(200);
      $res->header('Content-Type'  => $ct);
      $res->header('Cache-Control' => 'no-cache');
      $res->content($body);
      $c->send_response($res);
    } else {
      $c->send_error(RC_NOT_FOUND);
    }
  }
  $c->close;
}
