define([
  'view',
  'templates/conversation-view',
  'views/comment-view',
  'views/comment-form',
  'views/change-votes',
  'models/vote',
  'models/participant',
  'models/conversation',
  'models/comment',
  'models/user',
  'collections/comments',
  'collections/votes',
  'app',
  'CommentShower',
  'FeedbackSubmitter',
  'LoginView',
  'p',
  'polis',
  'polisUtils',
  'StimulusSubmitter',
  'VisView'
  ], function (View, 
    template,
    CommentView, 
    CommentFormView,
    ChangeVotesView,
    VoteModel,
    ParticipantModel,
    ConversationModel,
    CommentModel,
    UserModel,
    CommentsCollection,
    VotesCollection,
    app, 
    CommentShower, 
    FeedbackSubmitter,
    LoginView,
    p,
    polis,
    polisUtils,
    StimulusSubmitter,
    VisView
    ) {
  return View.extend({
    name: 'conversation-view',
    template: template,
    events: {
      "click #topic_toggle": function(e){
        e.preventDefault();
        this.$('#topic').toggle();
      },
      "click #react_tab": function(e){
        e.preventDefault();
        console.dir(this);
        console.dir(e);
        $(e.target).tab('show');
      },
      "click #write_tab": function(e){
        e.preventDefault();
        //$(this).tab('show')
        $(e.target).tab('show');
      }
    },
    initialize: function(){
      var that = this;
      var serverClient = new window.Polis({
        tokenStore: PolisStorage.token,
        emailStore: PolisStorage.email,
        usernameStore: PolisStorage.username,
        pidStore: PolisStorage.pids,
        uidStore: PolisStorage.uid,
        //commentsStore: PolisStorage.comments,
        //reactionsByMeStore: PolisStorage.reactionsByMe,
        utils: window.utils,
        protocol: "",  //"http",
        domain: (-1 !== document.domain.indexOf(".polis.io")) ? "api.polis.io" : "localhost:5000",
        basePath: "",
        logger: console
      });
      serverClient.observeStimulus(this.model.get('zid'));
      //var commentCollection = new Application.Collections["comments"]();
      this.commentView = new CommentView({
        serverClient: serverClient,
        zid: this.zid,
      });
      this.commentsByMe = new CommentsCollection();
        // Application.Models["comment"]
      this.commentForm = new CommentFormView({
        serverClient: serverClient,
        zid: this.zid,
      });
      this.changeVotes = new ChangeVotesView({
        serverClient: serverClient,
        zid: this.zid,
      })
      this.commentForm.on("commentSubmitted", function() {
        $("#react_tab").tab('show');
      });
       var initPcaVis = function() {
           var w = $("#visualization_div").width();
           var h = w/2;
           $("#visualization_div").height(h);
           PcaVis.initialize({
               getPersonId: function() {
                                return PolisStorage.pids.get(that.zid);
                            },
               getCommentsForProjection: serverClient.getCommentsForProjection,
               getCommentsForSelection: serverClient.getCommentsForSelection,
               getReactionsToComment: serverClient.getReactionsToComment,
               w: w,
               h: h,
               el_queryResultSelector: "#query_results_div",
               el: "#visualization_div"
           });
       };
       serverClient.addPersonUpdateListener( function() {
           PcaVis.upsertNode.apply(PcaVis, arguments);
       });
       // Let the DOM finish its layout
       _.defer(initPcaVis);
    }// end initialize
  });
});