var eb = require("../eventBus");
var Handlebones = require("handlebones");
var template = require("../tmpl/vote-view");
var CommentModel = require("../models/comment");
var serverClient = require("../stores/polis");
var Utils = require("../util/utils");
var Strings = require("../strings");

var iOS = Utils.isIos();

module.exports = Handlebones.ModelView.extend({
    name: "vote-view",
    template: template,
    events: {
      "click #agreeButton": "participantAgreed",
      "click #disagreeButton": "participantDisagreed",
      "click #passButton": "participantPassed",
      "click #subscribeBtn": "subscribeBtn",
      "click #starBtn": "starBtn",
      "hover .starbutton": function(){
        this.$(".starbutton").html("<i class='fa fa-star'></i>");
      }
    },
  context: function() {
    var ctx = Handlebones.ModelView.prototype.context.apply(this, arguments);
    ctx.iOS = iOS;
    ctx.customStyles = "";
    // if (ctx.txt && ctx.txt.length < 30) {
    //   ctx.customStyles += "text-align: center; ";
      // ctx.customStyles += "padding-top: 39px; ";
    //   ctx.customStyles += "font-size: 22px; ";
    // }
    ctx.email = userObject.email;
    ctx.subscribed = this.isSubscribed();
    if (ctx.created) {
      ctx.createdString = (new Date(ctx.created * 1)).toString().match(/(.*?) [0-9]+:/)[1];
    }
    ctx.s = Strings;

    var social = ctx.social;
    var socialCtx = {
      name: Strings.anonPerson,
      img: Utils.getAnonPicUrl(),
      link: "",
      anon: true,
    };
    if (social) {
      var hasTwitter = social.screen_name;
      var hasFacebook = social.fb_name;
      if (hasFacebook) {
        socialCtx = {
          name: social.fb_name,
          img: social.fb_picture,
          link: social.fb_link,
        };
      }
      if (hasTwitter) {
        socialCtx = {
          name: social.name,
          img: social.profile_image_url_https,
          link: "https://twitter.com/" + social.screen_name,
          screen_name: social.screen_name,
        };
      }
    }
    ctx.social = socialCtx;

    return ctx;
  },
  animateOut: function() {
    // Animating opacity directly instead of jQuery's fadeOut because we don't want display:none at the end.
    this.$el.children().children().animate({
      opacity: 0
    }, 200);
  },
  animateIn: function() {
    this.$el.children().children().animate({
      opacity: 1
    }, 200);
  },
  initialize: function(options) {
    Handlebones.ModelView.prototype.initialize.apply(this, arguments);
      eb.on(eb.exitConv, cleanup);
    function cleanup() {
      //alert('cleanup');
      eb.off(eb.exitConv, cleanup);
    }
    var serverClient = options.serverClient;
    var votesByMe = options.votesByMe;
    var votesByMeFetched = $.Deferred();
    votesByMeFetched.then(function() {
      if (votesByMe.size() > 0) {
        eb.trigger(eb.interacted);
      }
    });
    this.conversationModel = options.conversationModel;

    var is_public = options.is_public;
    var conversation_id = this.conversation_id = options.conversation_id;
    var pid = this.pid = options.pid;
    this.isSubscribed = options.isSubscribed;
    console.dir(serverClient);

    if (this.pid < 0) {
      // DEMO_MODE
      votesByMeFetched.resolve();
    }
    votesByMe.on("sync", votesByMeFetched.resolve);


    var that = this;
    var waitingForComments = true;
    var commentPollInterval = 5 * 1000;
    function pollForComments(optionalPromiseForPreExisingNextCommentCall) {
      if (waitingForComments && !Utils.isHidden()) {
          getNextAndShow(optionalPromiseForPreExisingNextCommentCall);
      } else {
        // try to try again later
        setTimeout(pollForComments, commentPollInterval);
      }
    }
    function showComment(model) {
      that.model.clear({silent: true});
      that.model.set(_.extend({
        empty: false
      }, model));
      that.render();
      that.trigger("showComment");
      waitingForComments = false;
    }
    function getNextAndShow(optionalPromiseForPreExisingNextCommentCall) {
      var params = {};
      if (that.model && that.model.get("tid")) {
        params.notTid = that.model.get("tid");
      }
      var promise = optionalPromiseForPreExisingNextCommentCall || serverClient.getNextComment(params);
      promise.then(function(c) {
        var email = that.$(".email").val();
        if (!email) { // Don't clobber view if user is writing an email
          if (!that.conversationModel.get("is_active")) {
            showClosedConversationNotice();
          } else if (c && c.txt) {
            showComment(c);
          } else {
            showEmpty();
          }
        }
        setTimeout(pollForComments, commentPollInterval);
      }, function(err) {
        setTimeout(pollForComments, commentPollInterval);
      });
    }
    function onFail(err) {
      this.animateIn();
      console.error(err);

      if (!Utils.cookiesEnabled()) {
        // TODO send GA event
        alert("Sorry, voting requires cookies to be enabled. If you do enable cookies, be sure to reload the page after.");
      } else if (err && err.responseText === "polis_err_conversation_is_closed"){
        alert("This conversation is closed. No further voting is allowed.");
      } else {
        alert("Apologies, your vote failed to send. Please check your connection and try again.");
      }
    }
    function onVote(result) {
      var that = this;
      eb.trigger(eb.vote, this.mostRecentVoteType);
      eb.trigger(eb.interacted);
      if (result.nextComment) {
        showComment(result.nextComment);
      } else {
        showEmpty();
      }
      this.animateIn();

      // Fix for stuck hover effects for touch events.
      // Remove when this is fix is accepted
      // https://github.com/twbs/bootstrap/issues/12832
      this.$(".btn-vote").blur();
    }
    function showClosedConversationNotice() {
      that.model.clear({silent: true});
      that.model.set({
        empty: true,
        txt1: "This conversation is closed.",
        txt2: "No further voting is allowed."
      });
      that.render();
    }
    function showEmpty() {
      var userHasVoted = !!votesByMe.size();

      waitingForComments = true;
      // pollForComments();

      var message1;
      var message2;
      if (userHasVoted) {
        message1 = "You've voted on all the comments.";
        message2 = "If you have something to add, try writing your own comment.";
      } else {
        message1 = "There aren't any comments yet.";
        if (is_public) {
          message2 =  "Get this conversation started by inviting more participants, or add a comment.";
        } else {
          message2 =  "Get this conversation started by adding a comment.";
        }
      }

      // TODO show some indication of whether they should wait around or not (how many active users there are, etc)
      that.model.clear({silent: true});
      that.model.set({
        empty: true,
        txt1: message1,
        txt2: message2
      });
      that.render();
    }

    this.onButtonClicked = function() {
      this.animateOut();
    };
    this.starBtn = function(e) {
      var starred = !that.model.get("starred");

      that.model.set("starred", starred);
      if (starred) {
        $("#starredLabel").fadeIn(200);
        setTimeout(function() {
          $("#starredLabel").fadeOut(600);
        }, 1500);
      }
    };
    this.subscribeBtn = function(e) {
      var that = this;
      var email = this.$(".email").val();
      serverClient.convSub({
        type: 1, // 1 for email
        email: email,
        conversation_id: conversation_id
      }).then(function() {
        userObject.email = that.$(".email").val(); // TODO this is kinda crappy
        that.isSubscribed(1); // TODO this is totally crappy
        that.$(".email").val("");
        that.model.set("foo", Math.random()); // trigger render
        // alert("you have subscribed");
      }, function(err) {
        alert("Error subscribing");
        console.error(err);
      });
    };
    this.participantAgreed = function(e) {
      this.mostRecentVoteType = "agree";
      var tid = this.model.get("tid");
      var starred = this.model.get("starred");
      if (!starred) {
        starred = void 0; // don't bother sending up false, no need to put a vote value of 0 in the db.
      }
      votesByMe.add({
        vote: -1,
        conversation_id: conversation_id,
        pid: pid,
        tid: tid
      });
      this.onButtonClicked();
      serverClient.agree(tid, starred)
          .then(onVote.bind(this), onFail.bind(this));
    };
    this.participantDisagreed = function() {
      this.mostRecentVoteType = "disagree";
      var tid = this.model.get("tid");
      var starred = this.model.get("starred");
      votesByMe.add({
        vote: 1,
        conversation_id: conversation_id,
        pid: pid,
        tid: tid
      });
      this.onButtonClicked();
      serverClient.disagree(tid, starred)
          .then(onVote.bind(this), onFail.bind(this));
    };
    this.participantPassed = function() {
      this.mostRecentVoteType = "pass";
      var tid = this.model.get("tid");
      var starred = this.model.get("starred");
      votesByMe.add({
        vote: 0,
        conversation_id: conversation_id,
        pid: pid,
        tid: tid
      });
      this.onButtonClicked();
      serverClient.pass(tid, starred)
          .then(onVote.bind(this), onFail.bind(this));
    };
    this.participantStarred = function() {
      var tid = this.model.get("tid");
      votesByMe.add({
        participantStarred: true,
        vote: -1,
        conversation_id: conversation_id,
        pid: pid,
        tid: tid
      });
      this.onButtonClicked();
      $.when(serverClient.star(tid), serverClient.agree(tid))
          .then(onVote.bind(this), onFail.bind(this));
    };
    this.participantTrashed = function() {
      var tid = this.model.get("tid");
      this.onButtonClicked();
      serverClient.trash(tid)
          .then(onVote.bind(this), onFail.bind(this));
    };

    pollForComments(options.firstCommentPromise); // call immediately using a promise for the first comment (latency reduction hack)
    this.listenTo(this, "rendered", function(){
      // this.$("#agreeButton").tooltip({
      //   title: "This comment represents my opinion",
      //   placement: "right",
      //   delay: { show: 500, hide: 0 },
      //   container: "body"
      // });
      // this.$("#disagreeButton").tooltip({
      //   title: "This comment does not represent my opinion",
      //   placement: "top",
      //   delay: { show: 500, hide: 0 }
      // });
      this.$("#passButton").tooltip({
        title: "'No reaction', or 'I am unsure'",
        placement: "top",
        delay: { show: 500, hide: 0 }
      });
      this.$("#starButton").tooltip({
        title: "'Critical point', or 'central to my worldview'",
        placement: "top",
        delay: { show: 500, hide: 0 },
        container: "body"
      });
      this.$("#trashButton").tooltip({
        title: "This comment is irrelevant and/or abusive",
        placement: "top",
        delay: { show: 500, hide: 0 }
      });


    });
  }
  });
